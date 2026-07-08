import { ENTITY_TYPES } from "../references/EntityRef.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isActiveRelationship(rel) {
  if (!rel) return false;
  if (rel.effectiveTo) return false;
  return String(rel.status ?? "active") === "active";
}

/**
 * Parties with an active INTERESTED_IN relationship to a canonical subject.
 */
export function queryPartiesInterestedInSubject({ businessGraphRuntime, subjectId } = {}) {
  const sid = String(subjectId ?? "");
  if (!sid || !businessGraphRuntime) return [];

  const partyIds = new Set();
  for (const rel of safeArray(businessGraphRuntime.getRelationships?.())) {
    if (!isActiveRelationship(rel)) continue;
    if (String(rel.relationshipType) !== "INTERESTED_IN") continue;
    if (String(rel.toEntity?.entityType) !== ENTITY_TYPES.SUBJECT) continue;
    if (String(rel.toEntity?.entityId) !== sid) continue;
    if (String(rel.fromEntity?.entityType) === ENTITY_TYPES.PARTY) {
      partyIds.add(String(rel.fromEntity.entityId));
    }
  }

  return [...partyIds];
}
