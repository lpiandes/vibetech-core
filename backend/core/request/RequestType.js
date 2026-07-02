export const DEFAULT_REQUEST_TYPE = "generic";

export function isValidRequestType(requestType) {
  if (requestType === null || requestType === undefined) return false;
  if (typeof requestType !== "string") return false;
  const s = requestType.trim();
  // Keep validation permissive to avoid hardcoding industries.
  return s.length > 0 && s.length <= 150;
}

export function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestType: expected ${name} to be a non-empty string.`);
  return value;
}

