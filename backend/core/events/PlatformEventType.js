const PLATFORM_EVENT_TYPE_REGEX = /^[A-Z0-9_]+$/;

export function isValidPlatformEventType(value) {
  return typeof value === "string" && PLATFORM_EVENT_TYPE_REGEX.test(value);
}

export function requirePlatformEventType(value) {
  if (!isValidPlatformEventType(value)) throw new Error(`PlatformEventType: invalid eventType: ${String(value)}`);
  return value;
}

