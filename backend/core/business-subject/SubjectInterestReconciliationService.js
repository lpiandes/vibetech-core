import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { INTERACTION_EVENT_TYPES } from "../interactions/InteractionEventTypes.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";
import { extractRelatedObjectRefs, mergeRelatedObjects } from "../engagement/_utils/relatedObjectRefs.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";

import { resolveExactSubjectInterestFromText } from "./SubjectInterestTextResolver.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "_");
}

function firstPartyId(interaction) {
  const participant = safeArray(interaction?.participants).find((entry) => entry?.partyId);
  if (participant?.partyId) return String(participant.partyId);
  const refs = extractRelatedObjectRefs(interaction?.relatedObjects);
  return refs.partyIds[0] ?? null;
}

function firstRequestId(interaction) {
  const refs = extractRelatedObjectRefs(interaction?.relatedObjects);
  return refs.requestIds[0] ?? null;
}

function hasSubjectRef(refs, subjectId) {
  return safeArray(refs).some(
    (ref) => String(ref?.entityType) === ENTITY_TYPES.SUBJECT && String(ref?.entityId) === String(subjectId),
  );
}

function relationshipId({ partyId, subjectId }) {
  return `rel_INTERESTED_IN_${sanitizeId(partyId)}_${sanitizeId(subjectId)}`;
}

function relationshipExists(businessGraphRuntime, { partyId, subjectId }) {
  const id = relationshipId({ partyId, subjectId });
  const existing = businessGraphRuntime?.getRelationship?.(id);
  if (existing && String(existing.status) === "active") return true;
  return safeArray(businessGraphRuntime?.getRelationships?.()).some(
    (rel) =>
      String(rel?.relationshipType) === "INTERESTED_IN" &&
      String(rel?.status ?? "active") === "active" &&
      String(rel?.fromEntity?.entityType) === ENTITY_TYPES.PARTY &&
      String(rel?.fromEntity?.entityId) === String(partyId) &&
      String(rel?.toEntity?.entityType) === ENTITY_TYPES.SUBJECT &&
      String(rel?.toEntity?.entityId) === String(subjectId),
  );
}

function createRelationship({ businessGraphRuntime, partyId, subjectId, nowISO, evidence }) {
  if (relationshipExists(businessGraphRuntime, { partyId, subjectId })) return false;
  const id = relationshipId({ partyId, subjectId });
  businessGraphRuntime.applyEvent({
    id: `evt_subject_interest_reconciled_${sanitizeId(id)}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "subject_interest_reconciliation",
    payload: {
      relationship: {
        id,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: String(partyId) }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: String(subjectId) }),
        relationshipType: "INTERESTED_IN",
        status: "active",
        effectiveFrom: nowISO,
        effectiveTo: null,
        metadata: { source: "historical_note_reconciliation", evidence },
        createdAt: nowISO,
        updatedAt: nowISO,
      },
    },
  });
  return true;
}

function patchRequestSubjectRef({ requestRuntime, requestId, subjectRef, nowISO }) {
  const request = requestRuntime?.getRequest?.(requestId);
  if (!request || hasSubjectRef(request.subjectRefs, subjectRef.entityId)) return false;
  requestRuntime.applyEvent({
    id: `evt_request_subject_interest_reconciled_${sanitizeId(requestId)}_${sanitizeId(subjectRef.entityId)}`,
    timestampISO: nowISO,
    type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
    source: "subject_interest_reconciliation",
    payload: {
      requestId: String(requestId),
      patch: { subjectRefs: [...safeArray(request.subjectRefs), subjectRef] },
    },
  });
  return true;
}

function patchInteractionSubjectRef({ interactionRuntime, interaction, subjectRef, nowISO }) {
  if (!interaction || hasSubjectRef(interaction.relatedObjects, subjectRef.entityId)) return false;
  interactionRuntime.applyEvent({
    id: `evt_interaction_subject_interest_reconciled_${sanitizeId(interaction.id)}_${sanitizeId(subjectRef.entityId)}`,
    timestampISO: nowISO,
    type: INTERACTION_EVENT_TYPES.INTERACTION_RELATED_OBJECTS_UPDATED,
    source: "subject_interest_reconciliation",
    payload: {
      interactionId: String(interaction.id),
      relatedObjects: mergeRelatedObjects(interaction.relatedObjects, [subjectRef]),
    },
  });
  return true;
}

/**
 * @param {{ stack?: any, nowISO?: string }} [input]
 * @returns {{ changed: boolean, reconciledCount: number, skippedCount: number, snapshotKinds: string[] }}
 */
export function reconcileHistoricalSubjectInterests({
  stack,
  nowISO = new Date().toISOString(),
} = {}) {
  const businessGraphRuntime = stack?.businessGraphRuntime;
  const businessSubjectRuntime = stack?.businessSubjectRuntime;
  const requestRuntime = stack?.requestRuntime;
  const interactionRuntime = stack?.interactionRuntime;
  if (!businessGraphRuntime || !businessSubjectRuntime || !requestRuntime || !interactionRuntime) {
    return { changed: false, reconciledCount: 0, skippedCount: 0, snapshotKinds: [] };
  }

  const touchedKinds = new Set();
  let reconciledCount = 0;
  let skippedCount = 0;

  for (const interaction of safeArray(interactionRuntime.getInteractions?.())) {
    const partyId = firstPartyId(interaction);
    if (!partyId || !businessGraphRuntime.getParty?.(partyId)) {
      skippedCount += 1;
      continue;
    }

    const noteTexts = safeArray(interaction.notes).map((note) => String(note?.text ?? "")).filter(Boolean);
    if (!noteTexts.length) continue;

    const requestId = firstRequestId(interaction);
    if (!requestId || !requestRuntime.getRequest?.(requestId)) {
      skippedCount += 1;
      continue;
    }

    const matches = [];
    for (const text of noteTexts) {
      const resolved = resolveExactSubjectInterestFromText({ text, businessSubjectRuntime });
      if (resolved.matched) matches.push(resolved);
    }
    const uniqueSubjectIds = [...new Set(matches.map((match) => match.subjectId))];
    if (uniqueSubjectIds.length !== 1) {
      if (matches.length || noteTexts.length) skippedCount += 1;
      continue;
    }

    const subjectId = uniqueSubjectIds[0];
    const subjectRef = createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: subjectId });
    const evidence = {
      interactionId: String(interaction.id),
      requestId,
      matchTier: "exact_historical_note_subject_interest",
    };

    let changed = false;
    if (createRelationship({ businessGraphRuntime, partyId, subjectId, nowISO: String(nowISO), evidence })) {
      touchedKinds.add(RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH);
      changed = true;
    }
    if (requestId && patchRequestSubjectRef({ requestRuntime, requestId, subjectRef, nowISO: String(nowISO) })) {
      touchedKinds.add(RUNTIME_SNAPSHOT_KINDS.REQUEST);
      changed = true;
    }
    if (patchInteractionSubjectRef({ interactionRuntime, interaction, subjectRef, nowISO: String(nowISO) })) {
      touchedKinds.add(RUNTIME_SNAPSHOT_KINDS.INTERACTION);
      changed = true;
    }
    if (changed) {
      touchedKinds.add(RUNTIME_SNAPSHOT_KINDS.BUSINESS_SUBJECT);
      reconciledCount += 1;
    }
  }

  return {
    changed: touchedKinds.size > 0,
    reconciledCount,
    skippedCount,
    snapshotKinds: [...touchedKinds],
  };
}
