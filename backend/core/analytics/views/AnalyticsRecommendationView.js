import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsRecommendationView: ${message}`);
}

export function createAnalyticsRecommendationView({
  recommendationId,
  actionType,
  category,
  priority,
  title,
  recommendation,
  evidence,
  metadata,
} = {}) {
  if (!recommendationId) fail("recommendationId required.");
  if (!actionType) fail("actionType required.");
  if (!category) fail("category required.");
  if (priority === undefined || priority === null || typeof priority !== "number" || !Number.isFinite(priority)) fail("priority must be finite number.");
  if (!title) fail("title required.");
  if (!recommendation) fail("recommendation required.");

  const view = {
    recommendationId: String(recommendationId),
    actionType: String(actionType),
    category: String(category),
    priority: Number(priority),
    title: String(title),
    recommendation: String(recommendation),
    evidence: Array.isArray(evidence) ? deepFreeze(evidence.map((x) => String(x))) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

