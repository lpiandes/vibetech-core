import { validatePlatformEvent } from "./PlatformEventValidator.js";

function fail(message) {
  throw new Error(`PlatformEventStoreValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validatePlatformEventStore(store) {
  if (!store || typeof store !== "object") fail("store required.");
  if (!store._state || typeof store._state !== "object") fail("store._state required.");
  if (!Object.isFrozen(store._state)) fail("store._state must be frozen.");

  const { events, indexes, metrics } = store._state;
  if (!Array.isArray(events)) fail("store._state.events must be array.");

  // Validate events + immutability.
  for (const e of events) {
    if (!e || typeof e !== "object") fail("event must be object.");
    if (!Object.isFrozen(e)) fail("event must be frozen.");
    validatePlatformEvent(e);
  }

  if (!isPlainObject(indexes)) fail("store._state.indexes must be plain object.");
  if (!metrics || typeof metrics !== "object") fail("store._state.metrics must be object.");

  return { ok: true };
}

