import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsRecommendation: ${message}`);
}

export function createAnalyticsRecommendation({
  recommendationId,
  category,
  title,
  recommendation,
  priority,
  evidence,
} = {}) {
  if (!recommendationId) fail("recommendationId required.");
  if (!category) fail("category required.");
  if (!title) fail("title required.");
  if (!recommendation) fail("recommendation required.");
  const pr = priority === undefined ? 50 : priority;
  if (typeof pr !== "number" || !Number.isFinite(pr)) fail("priority must be finite number.");
  const rec = {
    recommendationId: String(recommendationId),
    category: String(category),
    title: String(title),
    recommendation: String(recommendation),
    priority: Number(pr),
    evidence: Array.isArray(evidence) ? deepFreeze(evidence.map((x) => String(x))) : deepFreeze([]),
  };
  return deepFreeze(rec);
}

