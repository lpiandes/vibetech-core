import { createEntityRef, isEntityRef, ENTITY_TYPES } from "./EntityRef.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

const SINGLE_KEY_ENTITY_MAP = {
  partyId: ENTITY_TYPES.PARTY,
  requestId: ENTITY_TYPES.REQUEST,
  workItemId: ENTITY_TYPES.WORK,
  workId: ENTITY_TYPES.WORK,
  interactionId: ENTITY_TYPES.INTERACTION,
  communicationThreadId: ENTITY_TYPES.COMMUNICATION_THREAD,
  communicationMessageId: ENTITY_TYPES.COMMUNICATION_MESSAGE,
  automationRunId: ENTITY_TYPES.AUTOMATION_RUN,
  approvalId: ENTITY_TYPES.APPROVAL,
  subjectId: ENTITY_TYPES.SUBJECT,
};

const PREFIX_ENTITY_MAP = [
  { prefix: "req_", entityType: ENTITY_TYPES.REQUEST },
  { prefix: "work_", entityType: ENTITY_TYPES.WORK },
  { prefix: "int_", entityType: ENTITY_TYPES.INTERACTION },
  { prefix: "subj_", entityType: ENTITY_TYPES.SUBJECT },
  { prefix: "party_", entityType: ENTITY_TYPES.PARTY },
];

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Normalize legacy relatedObjects / sourceReference shapes to EntityRef.
 */
export function toEntityRef(legacy) {
  if (!legacy) return null;
  if (isEntityRef(legacy)) return createEntityRef(legacy);

  if (typeof legacy === "string") {
    for (const { prefix, entityType } of PREFIX_ENTITY_MAP) {
      if (legacy.startsWith(prefix)) return createEntityRef({ entityType, entityId: legacy });
    }
    return null;
  }

  if (!isPlainObject(legacy)) return null;

  if (legacy.entityType && legacy.entityId) {
    return createEntityRef({ entityType: legacy.entityType, entityId: legacy.entityId });
  }

  if (legacy.type && legacy.id) {
    return createEntityRef({ entityType: String(legacy.type), entityId: String(legacy.id) });
  }

  if (legacy.kind && legacy.id) {
    const kindMap = {
      request: ENTITY_TYPES.REQUEST,
      work: ENTITY_TYPES.WORK,
      party: ENTITY_TYPES.PARTY,
      subject: ENTITY_TYPES.SUBJECT,
      interaction: ENTITY_TYPES.INTERACTION,
      approval: ENTITY_TYPES.APPROVAL,
    };
    const entityType = kindMap[String(legacy.kind).toLowerCase()] ?? String(legacy.kind);
    return createEntityRef({ entityType, entityId: String(legacy.id) });
  }

  if (legacy.sourceType && legacy.sourceId) {
    return createEntityRef({ entityType: String(legacy.sourceType), entityId: String(legacy.sourceId) });
  }

  for (const [key, entityType] of Object.entries(SINGLE_KEY_ENTITY_MAP)) {
    if (legacy[key]) return createEntityRef({ entityType, entityId: String(legacy[key]) });
  }

  return null;
}

export function toEntityRefs(legacyList) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(legacyList) ? legacyList : []) {
    const ref = toEntityRef(item);
    if (!ref) continue;
    const key = `${ref.entityType}:${ref.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return deepFreeze(out);
}

export function extractEntityIds(refs, entityType) {
  const et = String(entityType);
  return toEntityRefs(refs)
    .filter((r) => r.entityType === et)
    .map((r) => r.entityId);
}

export function entityRefsReferenceParty(refs, partyId) {
  return extractEntityIds(refs, ENTITY_TYPES.PARTY).includes(String(partyId));
}

export function entityRefKey(ref) {
  return `${ref.entityType}:${ref.entityId}`;
}
