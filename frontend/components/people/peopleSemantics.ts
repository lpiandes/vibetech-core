export type PeopleRelationshipRow = {
  type: string;
  status: string;
  effectiveTo?: string | null;
};

export type PeopleFilterDefinition = {
  id: string;
  label: string;
  predicate: Record<string, unknown>;
};

export type PeopleIndexItem = {
  partyId?: string;
  displayName?: string;
  partyType?: string;
  partyTypeLabel?: string | null;
  email?: string | null;
  phone?: string | null;
  relationshipTypes?: string[];
  relationshipLabels?: string[];
  relationships?: PeopleRelationshipRow[];
  partyStatus?: string;
  qualificationProfile?: Record<string, unknown>;
  primarySubjectId?: string | null;
  primarySubjectName?: string | null;
  subjectCount?: number;
  openRequestCount?: number;
  openWorkCount?: number;
  attentionLevel?: string;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  nextActionTitle?: string | null;
  href?: string | null;
};

export type PeopleFilter = string;

export type PeopleNextAction = {
  sourceType?: string | null;
  sourceId?: string | null;
};

const LEGACY_FILTER_OPTIONS: PeopleFilterDefinition[] = [
  { id: "all", label: "All", predicate: { type: "all" } },
  { id: "prospects", label: "Prospects", predicate: { type: "hasActiveRelationship", types: ["PROSPECT"] } },
  { id: "owners", label: "Owners", predicate: { type: "hasActiveRelationship", types: ["OWNER"] } },
  { id: "residents", label: "Residents", predicate: { type: "hasActiveRelationship", types: ["RESIDENT"] } },
  { id: "with_open_work", label: "With open work", predicate: { type: "openWork" } },
  { id: "with_property_interest", label: "With property interest", predicate: { type: "propertyInterest" } },
];

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function activeRelationshipTypes(item: PeopleIndexItem) {
  return safeArray<PeopleRelationshipRow>(item.relationships)
    .filter((rel) => String(rel?.status ?? "") === "active")
    .map((rel) => String(rel?.type ?? ""));
}

export function resolvePeopleFilters(peopleFilters: unknown): PeopleFilterDefinition[] {
  const filters = safeArray<PeopleFilterDefinition>(peopleFilters);
  return filters.length > 0 ? filters : LEGACY_FILTER_OPTIONS;
}

export function evaluatePeopleFilterPredicate({
  partyRow,
  predicate,
}: {
  partyRow: PeopleIndexItem;
  predicate: Record<string, unknown>;
}) {
  const type = String(predicate?.type ?? "all");
  if (type === "all") return true;

  if (type === "partyStatus") {
    const statuses = new Set(safeArray<string>(predicate.statuses).map(String));
    return statuses.has(String(partyRow.partyStatus ?? ""));
  }

  if (type === "hasActiveRelationship") {
    const exclude = new Set(safeArray<string>(predicate.excludePartyStatus).map(String));
    if (exclude.has(String(partyRow.partyStatus ?? ""))) return false;
    const wanted = new Set(safeArray<string>(predicate.types).map(String));
    const active = activeRelationshipTypes(partyRow);
    return active.some((relType) => wanted.has(relType));
  }

  if (type === "rentalInquiry") {
    const active = new Set(activeRelationshipTypes(partyRow));
    if (!active.has("PROSPECT")) return false;
    const intents = safeArray<string>(predicate.rentalIntents).map((v) => String(v).toLowerCase());
    const intent = String(partyRow.qualificationProfile?.intent ?? "").toLowerCase();
    return intents.includes(intent);
  }

  if (type === "openWork") {
    return Number(partyRow.openWorkCount ?? 0) > 0;
  }

  if (type === "propertyInterest") {
    return Number(partyRow.subjectCount ?? 0) > 0 || Boolean(partyRow.primarySubjectName);
  }

  return false;
}

export function filterPeople(parties: unknown, filterId: PeopleFilter, peopleFilters: unknown) {
  const rows = safeArray<PeopleIndexItem>(parties);
  const filters = resolvePeopleFilters(peopleFilters);
  const id = String(filterId ?? "all");
  if (id === "all") return rows;
  const definition = filters.find((f) => f.id === id);
  if (!definition) return rows;
  return rows.filter((row) =>
    evaluatePeopleFilterPredicate({ partyRow: row, predicate: definition.predicate }),
  );
}

export function searchPeople(parties: unknown, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return safeArray<PeopleIndexItem>(parties);

  return safeArray<PeopleIndexItem>(parties).filter((party) => {
    const haystack = [
      party.displayName,
      party.email,
      party.phone,
      party.primarySubjectName,
      ...(party.relationshipLabels ?? []),
      party.partyTypeLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function workQueueHrefForPeopleDetail(businessId: string, workId?: unknown) {
  const id = String(workId ?? "").trim();
  return `/b/${businessId}/work${id ? `?workId=${encodeURIComponent(id)}` : ""}`;
}

export function resolvePeopleDetailNextActionHref(businessId: string, action?: PeopleNextAction | null) {
  if (String(action?.sourceType ?? "") !== "work" || !action?.sourceId) return null;
  return workQueueHrefForPeopleDetail(businessId, action.sourceId);
}

export function derivePeopleCounts(parties: unknown, peopleFilters: unknown) {
  const rows = safeArray<PeopleIndexItem>(parties);
  const filters = resolvePeopleFilters(peopleFilters);
  const counts: Record<string, number> = {};
  for (const filter of filters) {
    counts[filter.id] = filterPeople(rows, filter.id, filters).length;
  }
  return {
    totalPeople: rows.length,
    prospects: filterPeople(rows, "prospects", filters).length,
    withOpenWork: filterPeople(rows, "with_open_work", filters).length,
    withPropertyInterest: filterPeople(rows, "with_property_interest", filters).length,
    filters: counts,
  };
}

export function sortPeople(parties: PeopleIndexItem[]) {
  return parties.slice().sort((a, b) => {
    const aActivity = String(a.lastActivityAt ?? "");
    const bActivity = String(b.lastActivityAt ?? "");
    if (aActivity !== bActivity) return bActivity.localeCompare(aActivity);
    return String(a.displayName ?? "").localeCompare(String(b.displayName ?? ""));
  });
}

export function relationshipText(party: PeopleIndexItem) {
  if (party.relationshipLabels?.length) return party.relationshipLabels.join(" · ");
  if (party.partyTypeLabel) return party.partyTypeLabel;
  return null;
}

export function contactLine(party: PeopleIndexItem) {
  const parts = [party.email, party.phone].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function activitySummary(party: PeopleIndexItem) {
  const parts: string[] = [];
  if (Number(party.openWorkCount ?? 0) > 0) {
    parts.push(`${party.openWorkCount} open work`);
  }
  if (Number(party.openRequestCount ?? 0) > 0) {
    parts.push(`${party.openRequestCount} open request${Number(party.openRequestCount) === 1 ? "" : "s"}`);
  }
  if (party.lastActivityLabel) {
    parts.push(`Last activity ${party.lastActivityLabel}`);
  }
  return parts.join(" · ");
}

export function needsAttention(item: PeopleIndexItem) {
  return String(item.attentionLevel ?? "") === "attention";
}
