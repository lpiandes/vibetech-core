import { BUSINESS_GRAPH_EVENT_TYPES } from "./BusinessGraphEventTypes.js";
import { createEntityRef, ENTITY_TYPES } from "../references/EntityRef.js";

export function relationshipIdFor(partyId, relationshipType) {
  return `rel_${String(relationshipType ?? "")}_${String(partyId ?? "")}`;
}

function partyExists(stack, partyId) {
  return Boolean(stack?.businessGraphRuntime?.getParty?.(partyId));
}

/**
 * Additive, idempotent relationship classification. Does not end existing relationships.
 */
export function ensurePartyRelationship({ stack, partyId, relationshipType, nowISO, metadata = {} } = {}) {
  const pid = String(partyId ?? "").trim();
  const type = String(relationshipType ?? "").trim();
  if (!stack?.businessGraphRuntime) {
    return { ok: false, reason: "graph_unavailable", message: "Business graph is not available." };
  }
  if (!pid || !type) {
    return { ok: false, reason: "validation_error", message: "Party and relationship type are required." };
  }
  if (!partyExists(stack, pid)) {
    return { ok: false, reason: "party_not_found", message: "Party was not found." };
  }

  const relId = relationshipIdFor(pid, type);
  const existing = stack.businessGraphRuntime.getRelationship(relId);
  if (existing && String(existing.status) === "active") {
    return { ok: true, duplicate: true, relationshipId: relId, relationship: existing };
  }

  const timestamp = String(nowISO ?? new Date().toISOString());
  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_${type.toLowerCase()}_${pid}_${timestamp.replace(/[^a-zA-Z0-9]/g, "_")}`,
    timestampISO: timestamp,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_CREATED,
    source: "party_relationship_classification",
    payload: {
      relationship: {
        id: relId,
        fromEntity: createEntityRef({ entityType: ENTITY_TYPES.PARTY, entityId: pid }),
        toEntity: { entityType: ENTITY_TYPES.ORGANIZATION, entityId: "org_workspace" },
        relationshipType: type,
        status: "active",
        effectiveFrom: timestamp,
        effectiveTo: null,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
  });

  return {
    ok: true,
    duplicate: false,
    relationshipId: relId,
    relationship: stack.businessGraphRuntime.getRelationship(relId),
  };
}

/**
 * Explicit lifecycle promotion — ends only the named fromRelationshipType when transition is registered.
 */
export function promotePartyRelationship({
  stack,
  partyId,
  fromRelationshipType,
  toRelationshipType,
  nowISO,
  lifecycleTransitions = [],
} = {}) {
  const pid = String(partyId ?? "").trim();
  const fromType = String(fromRelationshipType ?? "").trim();
  const toType = String(toRelationshipType ?? "").trim();
  if (!stack?.businessGraphRuntime) {
    return { ok: false, reason: "graph_unavailable", message: "Business graph is not available." };
  }
  if (!pid || !fromType || !toType) {
    return { ok: false, reason: "validation_error", message: "Party and relationship types are required." };
  }

  const allowed = Array.isArray(lifecycleTransitions)
    ? lifecycleTransitions.some((t) => String(t?.from) === fromType && String(t?.to) === toType)
    : false;
  if (!allowed) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Transition ${fromType} → ${toType} is not permitted.`,
    };
  }

  const fromRelId = relationshipIdFor(pid, fromType);
  const fromRel = stack.businessGraphRuntime.getRelationship(fromRelId);
  if (!fromRel || String(fromRel.status) !== "active") {
    return {
      ok: false,
      reason: "from_relationship_not_active",
      message: `Active ${fromType} relationship is required before promotion.`,
    };
  }

  const timestamp = String(nowISO ?? new Date().toISOString());
  stack.businessGraphRuntime.applyEvent({
    id: `evt_rel_end_${fromType.toLowerCase()}_${pid}_${timestamp.replace(/[^a-zA-Z0-9]/g, "_")}`,
    timestampISO: timestamp,
    type: BUSINESS_GRAPH_EVENT_TYPES.RELATIONSHIP_ENDED,
    source: "party_relationship_classification",
    payload: { relationshipId: fromRelId },
  });

  const ensured = ensurePartyRelationship({
    stack,
    partyId: pid,
    relationshipType: toType,
    nowISO: timestamp,
  });
  if (!ensured.ok) return ensured;

  return {
    ok: true,
    fromRelationshipId: fromRelId,
    endedRelationship: stack.businessGraphRuntime.getRelationship(fromRelId),
    ...ensured,
  };
}

export function setPartyInactiveStatus({ stack, partyId, nowISO, status = "inactive" } = {}) {
  const pid = String(partyId ?? "").trim();
  const nextStatus = String(status ?? "inactive").trim();
  if (!stack?.businessGraphRuntime) {
    return { ok: false, reason: "graph_unavailable", message: "Business graph is not available." };
  }
  if (!pid) {
    return { ok: false, reason: "validation_error", message: "Party is required." };
  }
  const party = stack.businessGraphRuntime.getParty(pid);
  if (!party) {
    return { ok: false, reason: "party_not_found", message: "Party was not found." };
  }
  if (String(party.status) === nextStatus) {
    return { ok: true, duplicate: true, party };
  }

  const timestamp = String(nowISO ?? new Date().toISOString());
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_status_${pid}_${timestamp.replace(/[^a-zA-Z0-9]/g, "_")}`,
    timestampISO: timestamp,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_UPDATED,
    source: "party_relationship_classification",
    payload: {
      partyId: pid,
      patch: { status: nextStatus },
    },
  });

  return { ok: true, duplicate: false, party: stack.businessGraphRuntime.getParty(pid) };
}
