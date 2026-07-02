export function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestSource: expected ${name} to be a non-empty string.`);
  return value;
}

