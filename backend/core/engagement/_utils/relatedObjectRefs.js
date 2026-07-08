import { ENTITY_TYPES } from "../../references/EntityRef.js";
import { toEntityRef, toEntityRefs, extractEntityIds, entityRefsReferenceParty } from "../../references/EntityRefResolver.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function extractRelatedObjectRefs(relatedObjects = []) {
  const refs = toEntityRefs(relatedObjects);
  return {
    partyIds: extractEntityIds(refs, ENTITY_TYPES.PARTY),
    requestIds: extractEntityIds(refs, ENTITY_TYPES.REQUEST),
    workItemIds: extractEntityIds(refs, ENTITY_TYPES.WORK),
    interactionIds: extractEntityIds(refs, ENTITY_TYPES.INTERACTION),
    communicationThreadIds: extractEntityIds(refs, ENTITY_TYPES.COMMUNICATION_THREAD),
    communicationMessageIds: extractEntityIds(refs, ENTITY_TYPES.COMMUNICATION_MESSAGE),
    subjectIds: extractEntityIds(refs, ENTITY_TYPES.SUBJECT),
  };
}

export function relatedObjectsReferenceParty(relatedObjects, partyId) {
  return entityRefsReferenceParty(relatedObjects, partyId);
}

export function interactionReferencesParty(interaction, partyId) {
  if (!interaction) return false;
  const pid = String(partyId);
  const participants = Array.isArray(interaction.participants) ? interaction.participants : [];
  if (participants.some((p) => String(p?.partyId ?? "") === pid)) return true;
  return relatedObjectsReferenceParty(interaction.relatedObjects, pid);
}

export function entityReferencesParty({ relatedObjects, participants } = {}, partyId) {
  const pid = String(partyId);
  if (relatedObjectsReferenceParty(relatedObjects, pid)) return true;
  const ps = Array.isArray(participants) ? participants : [];
  return ps.some((p) => String(p?.partyId ?? p?.id ?? "") === pid);
}

export function mergeRelatedObjects(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const o of Array.isArray(list) ? list : []) {
      const ref = toEntityRef(o);
      const k = ref ? `${ref.entityType}:${ref.entityId}` : JSON.stringify(o);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(ref ?? o);
    }
  }
  return out;
}

// Legacy single-key bag builder for backward-compatible writers.
export function entityRefToLegacyBag(ref) {
  if (!ref) return null;
  const map = {
    [ENTITY_TYPES.PARTY]: "partyId",
    [ENTITY_TYPES.REQUEST]: "requestId",
    [ENTITY_TYPES.WORK]: "workItemId",
    [ENTITY_TYPES.INTERACTION]: "interactionId",
    [ENTITY_TYPES.COMMUNICATION_THREAD]: "communicationThreadId",
    [ENTITY_TYPES.COMMUNICATION_MESSAGE]: "communicationMessageId",
    [ENTITY_TYPES.SUBJECT]: "subjectId",
  };
  const key = map[ref.entityType];
  if (!key) return { entityType: ref.entityType, entityId: ref.entityId };
  return { [key]: ref.entityId };
}

export { toEntityRef, toEntityRefs };
