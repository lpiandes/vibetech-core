import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/** PM categories required by pm_resident_prospect_coordinator. */
export const PM_PROSPECT_COORDINATOR_KNOWLEDGE_CATEGORIES = [
  "PM_LEASING",
  "PM_RESIDENT_COMMUNICATION",
];

/**
 * Read-only bridge: durable platform knowledge documents satisfy PM category readiness
 * without copying into the in-memory KnowledgeRepository.
 */
export function buildPlatformKnowledgeCoverage({ activeDocumentCount, categoryIds } = {}) {
  const count = Number(activeDocumentCount ?? 0);
  const ids = Array.isArray(categoryIds) ? categoryIds.map(String) : [];
  if (count <= 0 || ids.length === 0) {
    return deepFreeze({ satisfiedCategoryIds: [], activeDocumentCount: count });
  }
  return deepFreeze({
    satisfiedCategoryIds: [...ids],
    activeDocumentCount: count,
  });
}

export function isCategorySatisfiedByPlatformKnowledge({ categoryId, platformKnowledgeCoverage } = {}) {
  const id = String(categoryId ?? "");
  const satisfied = platformKnowledgeCoverage?.satisfiedCategoryIds ?? [];
  return satisfied.includes(id);
}

export function isPmProspectCoordinatorKnowledgeReady({ companyRuntime, categoryId, platformKnowledgeCoverage } = {}) {
  if (isCategorySatisfiedByPlatformKnowledge({ categoryId, platformKnowledgeCoverage })) {
    return true;
  }
  const categories = companyRuntime?.getKnowledgeCategories?.()?.items ?? [];
  const cat = categories.find((c) => String(c.id) === String(categoryId));
  return Boolean(cat && Number(cat.activeKnowledgeCount ?? 0) > 0);
}

export function buildPmProspectCoordinatorPlatformCoverage(activeDocumentCount) {
  return buildPlatformKnowledgeCoverage({
    activeDocumentCount,
    categoryIds: PM_PROSPECT_COORDINATOR_KNOWLEDGE_CATEGORIES,
  });
}
