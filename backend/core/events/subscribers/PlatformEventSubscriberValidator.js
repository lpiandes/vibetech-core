import { SUBSCRIBER_RESULT_STATUS_LIST } from "./PlatformEventSubscriberDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventSubscriberValidator: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireFiniteInt(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) {
    fail(`${name} must be finite int >= 0.`);
  }
  return value;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function validateSubscriberShape(subscriber) {
  if (!subscriber || typeof subscriber !== "object") fail("subscriber required object.");
  requireString(subscriber.id, "subscriber.id");
  requireString(subscriber.name, "subscriber.name");
  requireString(subscriber.operatingSystem, "subscriber.operatingSystem");
  if (!Array.isArray(subscriber.supportedEvents)) fail("subscriber.supportedEvents must be array.");
  requireFiniteInt(subscriber.priority ?? 0, "subscriber.priority");
  if (typeof subscriber.enabled !== "boolean") fail("subscriber.enabled must be boolean.");
  if (typeof subscriber.handle !== "function") fail("subscriber.handle must be function.");
  // Ensure supportedEvents are strings.
  safeArray(subscriber.supportedEvents).map((x) => String(x));
  return true;
}

export function validateSubscriberResultShape(result) {
  if (!result || typeof result !== "object") fail("result required object.");
  if (!Object.isFrozen(result)) fail("result must be frozen.");
  requireString(result.subscriberId, "result.subscriberId");
  requireString(result.subscriberName, "result.subscriberName");
  requireString(result.eventId, "result.eventId");
  requireString(result.eventType, "result.eventType");
  const st = String(result.status ?? "");
  if (!SUBSCRIBER_RESULT_STATUS_LIST.includes(st)) fail(`invalid status: ${st}`);
  if (!Array.isArray(result.actions)) fail("result.actions must be array.");
  if (!Array.isArray(result.errors)) fail("result.errors must be array.");
  if (result.metadata !== undefined && !isPlainObject(result.metadata)) fail("result.metadata must be plain object.");
  if (typeof result.message !== "string") fail("result.message must be string.");
  return true;
}

export function validateSubscriberCompatibilityWithBus(subscriber) {
  // Compatibility with PlatformEventBus.subscribe contract:
  // bus expects: id, name, supportedEvents, priority, handle(event)
  if (!subscriber || typeof subscriber !== "object") fail("subscriber required object.");
  requireString(subscriber.id, "subscriber.id");
  requireString(subscriber.name, "subscriber.name");
  if (!Array.isArray(subscriber.supportedEvents)) fail("subscriber.supportedEvents must be array.");
  requireFiniteInt(subscriber.priority ?? 0, "subscriber.priority");
  if (typeof subscriber.handle !== "function") fail("subscriber.handle must be function.");
  return true;
}

