function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function activeRelationshipTypes(partyRow) {
  return safeArray(partyRow?.relationships)
    .filter((rel) => String(rel?.status ?? "") === "active")
    .map((rel) => String(rel?.type ?? ""));
}

/**
 * Evaluate a package-authored people filter predicate against an index row.
 */
export function evaluatePeopleFilterPredicate({ partyRow, predicate } = {}) {
  const p = predicate && typeof predicate === "object" ? predicate : { type: "all" };
  const type = String(p.type ?? "all");

  if (type === "all") return true;

  if (type === "partyStatus") {
    const statuses = new Set(safeArray(p.statuses).map(String));
    return statuses.has(String(partyRow?.partyStatus ?? ""));
  }

  if (type === "hasActiveRelationship") {
    const exclude = new Set(safeArray(p.excludePartyStatus).map(String));
    const partyStatus = String(partyRow?.partyStatus ?? "");
    if (exclude.has(partyStatus)) return false;
    const wanted = new Set(safeArray(p.types).map(String));
    const active = activeRelationshipTypes(partyRow);
    return active.some((relType) => wanted.has(relType));
  }

  if (type === "rentalInquiry") {
    const active = new Set(activeRelationshipTypes(partyRow));
    if (!active.has("PROSPECT")) return false;
    const intents = safeArray(p.rentalIntents).map((v) => String(v).toLowerCase());
    const intent = String(partyRow?.qualificationProfile?.intent ?? "").toLowerCase();
    return intents.includes(intent);
  }

  if (type === "openWork") {
    return Number(partyRow?.openWorkCount ?? 0) > 0;
  }

  if (type === "propertyInterest") {
    return Number(partyRow?.subjectCount ?? 0) > 0 || Boolean(partyRow?.primarySubjectName);
  }

  return false;
}

export function filterPartiesByPeopleFilter({ parties, filterId, peopleFilters } = {}) {
  const rows = safeArray(parties);
  const filters = safeArray(peopleFilters);
  const id = String(filterId ?? "all");
  if (id === "all") return rows;
  const definition = filters.find((f) => String(f?.id) === id);
  if (!definition) return rows;
  return rows.filter((row) => evaluatePeopleFilterPredicate({ partyRow: row, predicate: definition.predicate }));
}

export function derivePeopleFilterCounts({ parties, peopleFilters } = {}) {
  const rows = safeArray(parties);
  const filters = safeArray(peopleFilters);
  const counts = {};
  for (const filter of filters) {
    const id = String(filter?.id ?? "");
    if (!id) continue;
    counts[id] = filterPartiesByPeopleFilter({ parties: rows, filterId: id, peopleFilters: filters }).length;
  }
  return counts;
}
