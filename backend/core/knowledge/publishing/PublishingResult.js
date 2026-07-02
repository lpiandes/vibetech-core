function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`PublishingResult: expected ${name} to be a non-empty string.`);
  }
}

function requiredBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new Error(`PublishingResult: expected ${name} to be a boolean.`);
  }
}

/**
 * @param {object} input
 * @param {string} input.publishStatus "SUCCESS"|"FAILED"
 * @param {boolean} input.ok
 * @param {string} input.knowledgeItemId
 * @param {object=} input.publishedKnowledgeItem
 * @param {string[]} input.eventsPublished
 * @param {string} input.generatedAtISO
 * @param {string[]} input.warnings
 * @param {string[]} input.errors
 */
export function createPublishingResult(input = {}) {
  requiredNonEmptyString(input.publishStatus, "publishStatus");
  requiredBoolean(input.ok, "ok");
  requiredNonEmptyString(input.knowledgeItemId, "knowledgeItemId");
  requiredNonEmptyString(input.generatedAtISO, "generatedAtISO");

  const eventsPublished = Array.isArray(input.eventsPublished)
    ? input.eventsPublished.map((e) => String(e))
    : [];

  const warnings = Array.isArray(input.warnings) ? input.warnings.map((w) => String(w)) : [];
  const errors = Array.isArray(input.errors) ? input.errors.map((e) => String(e)) : [];

  const result = {
    publishStatus: String(input.publishStatus),
    ok: Boolean(input.ok),
    knowledgeItemId: String(input.knowledgeItemId),
    publishedKnowledgeItem: input.publishedKnowledgeItem ?? null,
    eventsPublished,
    generatedAtISO: String(input.generatedAtISO),
    warnings,
    errors,
  };

  return deepFreeze(result);
}

