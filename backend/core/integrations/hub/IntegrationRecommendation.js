import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "../../ai-builder/BuilderRecommendation.js";

/**
 * Integration recommendation — BuilderRecommendation + payload.
 * Every recommendation includes reason, confidence, evidence, alternatives.
 */
export function createIntegrationRecommendation({
  recommendationId,
  kind,
  label,
  reason = "",
  why = null,
  confidence = 0.7,
  evidence = [],
  alternatives = [],
  benefits = [],
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
    benefits: deepFreeze(Array.isArray(benefits) ? benefits.map(String) : []),
    payload: deepFreeze(payload && typeof payload === "object" ? payload : {}),
  });
}
