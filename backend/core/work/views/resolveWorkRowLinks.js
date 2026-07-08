function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export const NON_PARTY_REQUESTER_IDS = new Set(["unassigned", "tm_system", "unknown"]);

export function isValidPartyRef(partyId, businessGraphRuntime) {
  const id = String(partyId ?? "");
  if (!id || NON_PARTY_REQUESTER_IDS.has(id)) return false;
  return Boolean(businessGraphRuntime?.getParty?.(id));
}

export function resolveWorkPartyId({ workItem, requestRuntime, businessGraphRuntime } = {}) {
  const w = workItem ?? {};
  const request = w.requestId ? requestRuntime?.getRequest?.(String(w.requestId)) : null;
  const candidates = [];

  if (request?.requester) candidates.push(request.requester);
  if (w.requestedBy) candidates.push(w.requestedBy);
  for (const ref of safeArray(w.relatedObjects)) {
    if (String(ref?.entityType) === "Party" && ref?.entityId) {
      candidates.push(ref.entityId);
    }
  }

  for (const candidate of candidates) {
    if (isValidPartyRef(candidate, businessGraphRuntime)) {
      return String(candidate);
    }
  }
  return null;
}

export function resolveBusinessWorkLinks({
  partyId = null,
  subjectId = null,
  businessId = null,
  businessGraphRuntime = null,
  workItem = null,
  requestRuntime = null,
} = {}) {
  const resolvedPartyId =
    partyId && isValidPartyRef(partyId, businessGraphRuntime)
      ? String(partyId)
      : resolveWorkPartyId({ workItem, requestRuntime, businessGraphRuntime });
  const bid = String(businessId ?? "");
  const normalizedSubjectId = subjectId ? String(subjectId) : null;
  const personHref = resolvedPartyId && bid ? `/b/${bid}/people/${resolvedPartyId}` : null;
  const propertyHref = normalizedSubjectId && bid ? `/b/${bid}/properties/${normalizedSubjectId}` : null;

  return {
    partyId: resolvedPartyId,
    personHref,
    propertyHref,
    rowHref: personHref ?? propertyHref ?? null,
    engagementHref: null,
  };
}

export function resolvePrimarySubjectIdForParty({ partyId, businessGraphRuntime, businessSubjectRuntime } = {}) {
  const pid = String(partyId ?? "");
  if (!pid) return null;
  for (const rel of safeArray(businessGraphRuntime?.getRelationships?.())) {
    if (String(rel?.status) !== "active") continue;
    if (String(rel?.relationshipType) !== "INTERESTED_IN") continue;
    if (String(rel?.fromEntity?.entityType) !== "Party" || String(rel?.fromEntity?.entityId) !== pid) continue;
    if (String(rel?.toEntity?.entityType) !== "Subject") continue;
    const subjectId = String(rel.toEntity.entityId);
    if (businessSubjectRuntime?.getSubject?.(subjectId)) return subjectId;
  }
  return null;
}
