import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { WORK_EVENT_TYPES } from "../work/WorkEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { ensurePartyRelationship } from "../business-graph/partyRelationshipClassification.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const REFERRED_BY_RELATIONSHIP_TYPE = "REFERRED_BY";

export function referredByRelationshipId(introducedPartyId, referrerPartyId) {
  return `rel_referred_by_${String(introducedPartyId)}_${String(referrerPartyId)}`;
}

/**
 * Universal party→party referral attribution. Idempotent.
 */
export function ensureReferredByRelationship({
  stack,
  introducedPartyId,
  referrerPartyId,
  nowISO = new Date().toISOString(),
  metadata = {},
} = {}) {
  const introduced = String(introducedPartyId ?? "").trim();
  const referrer = String(referrerPartyId ?? "").trim();
  if (!stack?.businessGraphRuntime) return { ok: false, reason: "graph_unavailable" };
  if (!introduced || !referrer) return { ok: false, reason: "validation_error", message: "Introduced and referrer parties are required." };
  if (introduced === referrer) return { ok: false, reason: "validation_error", message: "A party cannot refer themselves." };
  if (!stack.businessGraphRuntime.getParty(introduced) || !stack.businessGraphRuntime.getParty(referrer)) {
    return { ok: false, reason: "party_not_found" };
  }

  const relId = referredByRelationshipId(introduced, referrer);
  const existing = stack.businessGraphRuntime.getRelationship(relId);
  if (existing && String(existing.status) === "active") {
    return { ok: true, duplicate: true, relationshipId: relId, relationship: existing };
  }

  const timestamp = String(nowISO);
  stack.businessGraphRuntime.applyEvent({
    id: `evt_${relId}_created`,
    timestampISO: timestamp,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "referral_loop",
    payload: {
      relationship: {
        id: relId,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: introduced }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: referrer }),
        relationshipType: REFERRED_BY_RELATIONSHIP_TYPE,
        status: "active",
        effectiveFrom: timestamp,
        effectiveTo: null,
        metadata: {
          ...metadata,
          referrerPartyId: referrer,
          introducedPartyId: introduced,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
  });

  ensurePartyRelationship({
    stack,
    partyId: referrer,
    relationshipType: "REFERRAL_SOURCE",
    nowISO: timestamp,
    metadata: { source: "referral_loop" },
  });

  return {
    ok: true,
    duplicate: false,
    relationshipId: relId,
    relationship: stack.businessGraphRuntime.getRelationship(relId),
  };
}

/**
 * Records a referred introduction when identity evidence is sufficient.
 * Vague text without party id does not create parties.
 */
export function recordReferralIntroduction({
  stack,
  referrerPartyId,
  introducedPartyId = null,
  introducedDisplayName = null,
  sourceInteractionId = null,
  sourceCommunicationId = null,
  createRequest = true,
  nowISO = new Date().toISOString(),
} = {}) {
  const referrer = String(referrerPartyId ?? "").trim();
  if (!referrer || !stack?.businessGraphRuntime?.getParty?.(referrer)) {
    return { ok: false, reason: "referrer_not_found", snapshotKinds: [] };
  }

  if (!introducedPartyId) {
    return {
      ok: true,
      unresolved: true,
      reason: "insufficient_identity_evidence",
      message: "Referral noted, but introduced person was not created without trusted identity evidence.",
      referrerPartyId: referrer,
      introducedDisplayName: introducedDisplayName ? String(introducedDisplayName) : null,
      snapshotKinds: [],
    };
  }

  const introduced = String(introducedPartyId);
  if (!stack.businessGraphRuntime.getParty(introduced)) {
    return { ok: false, reason: "introduced_party_not_found", snapshotKinds: [] };
  }

  const attribution = ensureReferredByRelationship({
    stack,
    introducedPartyId: introduced,
    referrerPartyId: referrer,
    nowISO,
    metadata: {
      sourceInteractionId,
      sourceCommunicationId,
    },
  });

  let requestId = null;
  if (createRequest && stack.requestRuntime) {
    requestId = `req_referral_${introduced}_${referrer}`;
    if (!stack.requestRuntime.getRequest?.(requestId)) {
      stack.requestRuntime.applyEvent({
        id: `evt_${requestId}_received`,
        timestampISO: String(nowISO),
        type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
        source: "referral_loop",
        payload: {
          request: {
            id: requestId,
            title: "Referral introduction",
            description: `Introduction attributed to referrer ${referrer}.`,
            requestType: "PROSPECT_INQUIRY",
            status: "received",
            priority: "medium",
            channel: "referral",
            source: "referral_loop",
            requester: introduced,
            receivedAt: String(nowISO),
            subjectRefs: [],
            metadata: {
              referral: {
                referrerPartyId: referrer,
                introducedPartyId: introduced,
                relationshipId: attribution.relationshipId,
                sourceInteractionId,
                sourceCommunicationId,
              },
            },
          },
        },
      });
    }
  }

  let workId = null;
  if (stack.workRuntime) {
    workId = `work_referral_${introduced}_${referrer}`;
    if (!stack.workRuntime.getWorkItem?.(workId)) {
      stack.workRuntime.applyEvent({
        id: `evt_${workId}_created`,
        timestampISO: String(nowISO),
        type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
        source: "referral_loop",
        payload: {
          workItem: {
            id: workId,
            title: "Follow up on referral introduction",
            description: "A referred introduction needs relationship follow-up.",
            workType: "referral_follow_up",
            status: "review_required",
            priority: "medium",
            stageId: "stage_intake",
            queueId: "queue_follow_up",
            assignedTo: "unassigned",
            requestedBy: referrer,
            source: "referral_loop",
            dueAt: String(nowISO),
            createdAt: String(nowISO),
            updatedAt: String(nowISO),
            completedAt: null,
            blockedReason: null,
            relatedObjects: [
              createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: introduced }),
              createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: referrer }),
              ...(requestId ? [createEntityRef({ entityType: ENTITY_TYPES.REQUEST, entityId: requestId })] : []),
            ],
            requirements: ["confirm_introduction", "qualify_referred_prospect"],
            metadata: {
              referral: {
                referrerPartyId: referrer,
                introducedPartyId: introduced,
                relationshipId: attribution.relationshipId,
                requestId,
                why: "A referred person was identified and needs human follow-up.",
                known: ["Referrer party", "Introduced party", "REFERRED_BY graph evidence"],
                missing: ["Qualification details", "Preferred next step"],
                recommendedNextAction: "Contact the introduced person and record qualification.",
              },
            },
          },
        },
      });
    }
  }

  return deepFreeze({
    ok: true,
    unresolved: false,
    referrerPartyId: referrer,
    introducedPartyId: introduced,
    relationshipId: attribution.relationshipId,
    requestId,
    workId,
    duplicate: Boolean(attribution.duplicate),
    snapshotKinds: [
      RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH,
      ...(requestId ? [RUNTIME_SNAPSHOT_KINDS.REQUEST] : []),
      ...(workId ? [RUNTIME_SNAPSHOT_KINDS.WORK] : []),
    ],
  });
}

export function buildReferralOperationsSummary({ stack } = {}) {
  const relationships = stack?.businessGraphRuntime?.getRelationships?.() ?? [];
  const referredBy = relationships.filter((rel) => String(rel.relationshipType) === REFERRED_BY_RELATIONSHIP_TYPE && String(rel.status) === "active");
  const referralSources = relationships.filter((rel) => String(rel.relationshipType) === "REFERRAL_SOURCE" && String(rel.status) === "active");
  const works = (stack?.workRuntime?.getWorkItems?.() ?? []).filter((work) => String(work.workType) === "referral_follow_up");
  const requests = (stack?.requestRuntime?.getRequests?.() ?? []).filter((request) => request?.metadata?.referral);
  return deepFreeze({
    referralSourceCount: referralSources.length,
    introductionsRecorded: referredBy.length,
    activeReferredInquiries: requests.filter((request) => !["completed", "cancelled", "closed"].includes(String(request.status))).length,
    openReferralWork: works.filter((work) => !["completed", "cancelled", "closed"].includes(String(work.status))).length,
    introductions: referredBy.map((rel) => ({
      relationshipId: rel.id,
      introducedPartyId: rel.fromEntity?.entityId ?? null,
      referrerPartyId: rel.toEntity?.entityId ?? null,
    })),
  });
}
