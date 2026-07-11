import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createBuilderRecommendation({
  recommendationId,
  kind,
  label,
  why = "",
  evidence = [],
  confidence = 0.6,
  alternatives = [],
  assumptions = [],
  missingCapabilities = [],
  selected = false,
} = {}) {
  if (!recommendationId) throw new Error("BuilderRecommendation: recommendationId required.");
  return deepFreeze({
    recommendationId: String(recommendationId),
    kind: String(kind),
    label: String(label),
    why: String(why),
    evidence: deepFreeze(Array.isArray(evidence) ? evidence : []),
    confidence: Number(confidence),
    alternatives: deepFreeze(Array.isArray(alternatives) ? alternatives : []),
    assumptions: deepFreeze(Array.isArray(assumptions) ? assumptions : []),
    missingCapabilities: deepFreeze(Array.isArray(missingCapabilities) ? missingCapabilities : []),
    selected: Boolean(selected),
  });
}
