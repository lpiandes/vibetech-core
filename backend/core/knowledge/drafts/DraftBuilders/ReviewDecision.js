function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * DraftEngine must not decide approval; it only propagates intelligence review requirement.
 */
export function buildReviewDecision({ intelligenceReport } = {}) {
  const reviewRequired = Boolean(intelligenceReport?.reviewRequired);
  const confidence = typeof intelligenceReport?.confidence === "number" ? intelligenceReport.confidence : 0;
  const warnings = Array.isArray(intelligenceReport?.warnings) ? intelligenceReport.warnings.map(String) : [];

  return deepFreeze({
    reviewRequired,
    confidence,
    warnings,
  });
}

