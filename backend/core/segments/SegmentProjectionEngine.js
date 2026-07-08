import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { evaluateSegmentCriteria, buildSegmentMatchExplanation } from "./SegmentConditionEvaluator.js";
import { checkCommunicationPermitted } from "../communications/preferences/CommunicationPreferenceEnforcer.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Deterministic read-only segment membership projection.
 */
export function projectSegmentMembership({
  segmentDefinition,
  businessGraphRuntime,
  requestRuntime,
  interactionRuntime,
  businessSubjectRuntime,
  preferenceRuntime,
  contactableOnly = false,
} = {}) {
  const def = segmentDefinition ?? {};
  const targetType = String(def.targetEntityType ?? "Party");
  const members = [];
  const explanations = [];

  if (targetType === "Party") {
    for (const party of safeArray(businessGraphRuntime?.getParties?.())) {
      const record = buildPartySegmentRecord({
        party,
        businessGraphRuntime,
        requestRuntime,
        interactionRuntime,
        businessSubjectRuntime,
      });
      if (!evaluateSegmentCriteria({ criteria: def.criteria, record })) continue;

      if (contactableOnly) {
        const emailOk = checkCommunicationPermitted({
          preferenceRuntime,
          partyId: party.id,
          channel: "email",
        });
        const smsOk = checkCommunicationPermitted({
          preferenceRuntime,
          partyId: party.id,
          channel: "sms",
        });
        if (!emailOk.permitted && !smsOk.permitted) continue;
      }

      members.push({
        entityType: ENTITY_TYPES.PARTY,
        entityId: String(party.id),
        displayName: party.displayName,
      });
      explanations.push({
        entityId: String(party.id),
        reasons: buildSegmentMatchExplanation({ criteria: def.criteria, record }),
      });
    }
  }

  return deepFreeze({ segmentId: def.id, members: deepFreeze(members), explanations: deepFreeze(explanations) });
}

function buildPartySegmentRecord({
  party,
  businessGraphRuntime,
  requestRuntime,
  interactionRuntime,
  businessSubjectRuntime,
} = {}) {
  const partyId = String(party.id);
  const relationships = safeArray(businessGraphRuntime?.getRelationships?.()).filter(
    (r) =>
      String(r.fromEntity?.entityId) === partyId ||
      String(r.toEntity?.entityId) === partyId,
  );

  const subjectIds = new Set();
  for (const rel of relationships) {
    if (String(rel.relationshipType) !== "INTERESTED_IN") continue;
    if (rel.fromEntity?.entityType === ENTITY_TYPES.SUBJECT) subjectIds.add(String(rel.fromEntity.entityId));
    if (rel.toEntity?.entityType === ENTITY_TYPES.SUBJECT) subjectIds.add(String(rel.toEntity.entityId));
  }

  const interactions = safeArray(interactionRuntime?.getInteractions?.()).filter((i) =>
    safeArray(i.participants).some((p) => String(p.partyId) === partyId),
  );

  const latestOutcome = interactions
    .map((i) => i.outcome)
    .filter(Boolean)
    .pop();

  const requests = safeArray(requestRuntime?.getRequests?.()).filter((r) => String(r.requester) === partyId);
  const qualificationProfile = buildLatestQualificationProfile(requests);
  const activeRelationshipTypes = relationships
    .filter(
      (r) =>
        (String(r.fromEntity?.entityId) === partyId || String(r.toEntity?.entityId) === partyId) &&
        String(r.status) === "active",
    )
    .map((r) => String(r.relationshipType))
    .filter((rt) => rt !== "REQUESTED_BY");

  return {
    partyId,
    partyType: party.partyType,
    status: party.status,
    partyStatus: party.status,
    relationshipTypes: relationships.map((r) => r.relationshipType),
    activeRelationshipTypes,
    qualificationProfile,
    subjectIds: [...subjectIds],
    subjectCount: subjectIds.size,
    requestCount: requests.length,
    interactionCount: interactions.length,
    latestOutcome: latestOutcome ?? null,
    hasIncompleteOutcome: interactions.some((i) => !i.outcome),
  };
}

function buildLatestQualificationProfile(requests) {
  const sorted = [...safeArray(requests)].sort((a, b) =>
    String(b?.receivedAt ?? b?.createdAt ?? "").localeCompare(String(a?.receivedAt ?? a?.createdAt ?? "")),
  );
  for (const request of sorted) {
    const qualification = request?.metadata?.qualification;
    if (qualification && typeof qualification === "object" && Object.keys(qualification).length > 0) {
      return qualification;
    }
  }
  return {};
}
