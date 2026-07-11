import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "../ai-builder/BuilderRecommendation.js";

/**
 * Data & Forms recommendation — BuilderRecommendation + payload.
 * Every recommendation includes reason, confidence, evidence, alternatives.
 */
export function createDataFormsRecommendation({
  recommendationId,
  kind,
  label,
  reason = "",
  why = null,
  confidence = 0.7,
  evidence = [],
  alternatives = [],
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
    payload: deepFreeze(payload && typeof payload === "object" ? payload : {}),
  });
}
