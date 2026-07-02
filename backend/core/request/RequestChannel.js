export const REQUEST_CHANNEL_TYPES = [
  "website",
  "phone",
  "email",
  "sms",
  "walk_in",
  "chat",
  "api",
  "referral",
  "manual",
];

export function isValidRequestChannel(channel) {
  return REQUEST_CHANNEL_TYPES.includes(String(channel ?? ""));
}

export function requireNonEmptyString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`RequestChannel: expected ${name} to be a non-empty string.`);
  return value;
}

