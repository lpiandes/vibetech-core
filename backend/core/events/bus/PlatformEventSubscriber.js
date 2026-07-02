import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`PlatformEventSubscriber: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requirePriority(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) {
    fail("priority must be a finite int >= 0.");
  }
  return value;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function createPlatformEventSubscriber({ id, name, supportedEvents, priority, handle } = {}) {
  requireString(id, "id");
  requireString(name, "name");
  const events = safeArray(supportedEvents).map((e) => String(e));
  requirePriority(priority);
  if (typeof handle !== "function") fail("handle required function.");

  return deepFreeze({
    id: String(id),
    name: String(name),
    supportedEvents: deepFreeze(events),
    priority,
    handle,
  });
}

