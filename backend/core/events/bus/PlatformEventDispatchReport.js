import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`PlatformEventDispatchReport: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireNumberFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${name} must be a finite number.`);
  return value;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function createPlatformEventDispatchReport({
  eventId,
  eventType,
  dispatchedAt,
  results,
  successCount,
  failureCount,
  skippedCount,
  metadata,
} = {}) {
  requireString(eventId, "eventId");
  requireString(eventType, "eventType");
  requireString(dispatchedAt, "dispatchedAt");

  if (!Array.isArray(results)) fail("results required array.");
  if (typeof successCount !== "number") fail("successCount required number.");
  if (typeof failureCount !== "number") fail("failureCount required number.");
  if (typeof skippedCount !== "number") fail("skippedCount required number.");
  requireNumberFinite(successCount, "successCount");
  requireNumberFinite(failureCount, "failureCount");
  requireNumberFinite(skippedCount, "skippedCount");

  const view = {
    eventId,
    eventType,
    dispatchedAt,
    results: deepFreeze(results),
    successCount,
    failureCount,
    skippedCount,
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

