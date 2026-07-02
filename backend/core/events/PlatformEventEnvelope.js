import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { isValidPlatformEventType } from "./PlatformEventType.js";

function fail(message) {
  throw new Error(`PlatformEventEnvelope: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

// Envelope is a lightweight wrapper used at boundaries (builder/transport).
// It must not implement or imply runtime behavior.
export function createPlatformEventEnvelope(input = {}) {
  const {
    eventId,
    eventType,
    version,
    occurredAt,
    publisher,
    aggregateType,
    aggregateId,
    correlationId,
    causationId,
    payload,
    metadata,
  } = input;

  if (!requireString(eventId, "eventId")) {}
  if (!isValidPlatformEventType(eventType)) fail("eventType must be UPPER_SNAKE_CASE.");
  if (typeof version !== "number" || !Number.isFinite(version)) fail("version must be a finite number.");
  if (typeof occurredAt !== "string" || !Number.isFinite(Date.parse(occurredAt))) fail("occurredAt must be ISO string.");
  requireString(publisher, "publisher");
  requireString(aggregateType, "aggregateType");
  requireString(aggregateId, "aggregateId");
  requireString(correlationId, "correlationId");
  requireString(causationId, "causationId");
  if (!isPlainObject(payload)) fail("payload must be a plain object.");
  if (!isPlainObject(metadata)) fail("metadata must be a plain object.");

  return deepFreeze({
    eventId,
    eventType,
    version,
    occurredAt,
    publisher,
    aggregateType,
    aggregateId,
    correlationId,
    causationId,
    payload,
    metadata,
  });
}

