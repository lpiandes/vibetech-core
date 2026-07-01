/**
 * BusinessContext (v1)
 *
 * Plain business model for employees.
 * No runtime/provider orchestration logic lives here.
 */

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

export function createBusinessContext(input) {
  const {
    structuredData = {},
    relevantDocuments = [],
    relevantPolicies = [],
    brandVoice = "",
    operationalRules = {},
    historicalMemory = { note: "placeholder", items: [] },
    summary = "",
    confidence = 0.5,
  } = input ?? {};

  const ctx = {
    structuredData,
    relevantDocuments,
    relevantPolicies,
    brandVoice,
    operationalRules,
    historicalMemory,
    summary,
    confidence,
  };

  return deepFreeze(ctx);
}

