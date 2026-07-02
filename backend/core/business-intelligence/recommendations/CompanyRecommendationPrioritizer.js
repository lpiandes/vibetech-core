import {
  RECOMMENDATION_IMPACT_RANK,
  RECOMMENDATION_EFFORT_RANK,
  RECOMMENDATION_STATUS_RANK,
} from "./CompanyRecommendationDefaults.js";

function recommendedSortKey(c) {
  // Lower is better.
  const depCount = Array.isArray(c.dependencies) ? c.dependencies.length : 0;
  const blockedRank = RECOMMENDATION_STATUS_RANK[String(c.status ?? "open")] ?? 0;
  // Normalize: open=0, blocked=1 -> open first.
  return [
    Number(c.sourcePriorityRank ?? 10),
    Number(c.severityRank ?? 10),
    depCount,
    RECOMMENDATION_IMPACT_RANK[String(c.impact)] ?? 9,
    RECOMMENDATION_EFFORT_RANK[String(c.effort)] ?? 9,
    blockedRank,
    String(c.id).localeCompare(String(c.id)),
  ];
}

function compareSortKeys(a, b) {
  const keysA = a.sortKey;
  const keysB = b.sortKey;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return keysA[i] - keysB[i];
  }
  return 0;
}

export function prioritizeCompanyRecommendations({ candidates } = {}) {
  if (!Array.isArray(candidates)) throw new Error("prioritizeCompanyRecommendations: candidates array required.");

  const normalized = candidates.map((c) => {
    const deps = Array.isArray(c.dependencies) ? c.dependencies : [];
    const status = c.status ?? (deps.length > 0 ? "blocked" : "open");
    const sourcePriorityRank = Number(c.sourcePriorityRank ?? 10);
    const severityRank = Number(c.severityRank ?? 10);
    const sortKey = recommendedSortKey({ ...c, status, sourcePriorityRank, severityRank });

    return {
      ...c,
      status,
      depsCount: deps.length,
      sortKey,
    };
  });

  normalized.sort((a, b) => {
    const keysA = a.sortKey;
    const keysB = b.sortKey;
    for (let i = 0; i < keysA.length; i += 1) {
      if (keysA[i] !== keysB[i]) {
        if (typeof keysA[i] === "string") return String(keysA[i]).localeCompare(String(keysB[i]));
        return keysA[i] - keysB[i];
      }
    }
    return 0;
  });

  const ranked = normalized;
  const top = ranked[0] ?? null;

  // Deterministic grouping from ranked ordering.
  const immediateCount = ranked.length > 0 ? 1 : 0;
  const soonCount = ranked.length - immediateCount > 0 ? Math.min(2, ranked.length - immediateCount) : 0;

  const immediateActions = ranked.slice(0, immediateCount).map((x) => x);
  const nextActions = ranked.slice(immediateCount, immediateCount + soonCount).map((x) => x);
  const laterActions = ranked.slice(immediateCount + soonCount).map((x) => x);

  // Assign priority based on tier.
  const prioritized = {
    topRecommendation: top,
    immediateActions,
    nextActions,
    laterActions,
    ranked,
  };

  return prioritized;
}

