import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "../../ai-builder/BuilderRecommendation.js";

export function createAnalyticsRecommendation({
  recommendationId,
  kind,
  label,
  reason = "",
  why = null,
  confidence = 0.7,
  evidence = [],
  alternatives = [],
  calculationExplanation = "",
  requiredData = [],
  payload = {},
  selected = true,
  assumptions = [],
  missingCapabilities = [],
} = {}) {
  const base = createBuilderRecommendation({
    recommendationId,
    kind,
    label,
    why: why ?? reason,
    evidence,
    confidence,
    alternatives,
    assumptions,
    missingCapabilities,
    selected,
  });
  return deepFreeze({
    ...base,
    reason: String(reason || base.why),
    calculationExplanation: String(calculationExplanation || ""),
    requiredData: deepFreeze(Array.isArray(requiredData) ? requiredData.map(String) : []),
    payload: deepFreeze(payload && typeof payload === "object" ? payload : {}),
  });
}
