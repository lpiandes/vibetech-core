import { BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

function sanitizeId(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "_");
}

function requireString(value, name) {
  if (!value || typeof value !== "string") {
    throw new Error(`partySubjectRelationship: ${name} required string.`);
  }
  return String(value);
}

export function partySubjectRelationshipId({
  partyId,
  subjectId,
  relationshipType = "INTERESTED_IN",
} = {}) {
  return `rel_${sanitizeId(relationshipType)}_${sanitizeId(partyId)}_${sanitizeId(subjectId)}`;
}

export function ensurePartySubjectRelationship({
  stack,
  partyId,
  subjectId,
  relationshipType = "INTERESTED_IN",
  nowISO = new Date().toISOString(),
  source = "party_subject_relationship",
  metadata = {},
} = {}) {
  if (!stack?.businessGraphRuntime) {
    throw new Error("partySubjectRelationship: businessGraphRuntime required.");
  }
  if (!stack?.businessSubjectRuntime) {
    throw new Error("partySubjectRelationship: businessSubjectRuntime required.");
  }

  const pid = requireString(partyId, "partyId");
  const sid = requireString(subjectId, "subjectId");
  const type = requireString(relationshipType, "relationshipType");

  if (!stack.businessGraphRuntime.getParty(pid)) {
    return { ok: false, reason: "party_not_found", message: `Party not found: ${pid}` };
  }
  if (!stack.businessSubjectRuntime.getSubject(sid)) {
    return { ok: false, reason: "subject_not_found", message: `Subject not found: ${sid}` };
  }

  const relationshipId = partySubjectRelationshipId({ partyId: pid, subjectId: sid, relationshipType: type });
  const existing = stack.businessGraphRuntime.getRelationship(relationshipId);
  if (existing && String(existing.status) === "active") {
    return { ok: true, duplicate: true, relationshipId, relationship: existing };
  }
  if (existing) {
    return { ok: false, reason: "relationship_ended", message: `Relationship already ended: ${relationshipId}` };
  }

  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_subject_relationship_created_${sanitizeId(relationshipId)}`,
    timestampISO: nowISO,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source,
    payload: {
      relationship: {
        id: relationshipId,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: pid }),
        toEntity: createEntityRef({ entityType: ENTITY_TYPES.SUBJECT, entityId: sid }),
        relationshipType: type,
        status: "active",
        effectiveFrom: nowISO,
        effectiveTo: null,
        metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
        createdAt: nowISO,
        updatedAt: nowISO,
      },
    },
  });

  return {
    ok: true,
    duplicate: false,
    relationshipId,
    relationship: stack.businessGraphRuntime.getRelationship(relationshipId),
  };
}
