export function isValidRequestSource(source) {
  if (source === null || source === undefined) return false;
  if (typeof source !== "string") return false;
  const s = source.trim();
  return s.length > 0 && s.length <= 200;
}

export function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestSource: expected ${name} to be a non-empty string.`);
  return value;
}

