export const REQUEST_PRIORITY_TYPES = ["low", "medium", "high", "critical"];

export function isValidRequestPriority(priority) {
  return REQUEST_PRIORITY_TYPES.includes(String(priority ?? ""));
}

export function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestPriority: expected ${name} to be a non-empty string.`);
}

// Priority is intentionally not enum-bound yet (future extensible).
export function normalizeRequestPriority(value) {
  requireNonEmptyString(value, "priority");
  return value;
}

