import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { isValidPlatformEventType } from "./PlatformEventType.js";

function fail(message) {
  throw new Error(`PlatformEvent: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireISO(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required ISO string.`);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${name} invalid ISO string.`);
  return value;
}

function requireFiniteInt(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) fail(`${name} must be a finite int >= 0.`);
  return value;
}

export function createPlatformEvent({
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
} = {}) {
  requireString(eventId, "eventId");
  if (!isValidPlatformEventType(eventType)) fail(`eventType invalid: ${String(eventType)}`);
  requireFiniteInt(version, "version");
  requireISO(occurredAt, "occurredAt");

  requireString(publisher, "publisher");
  requireString(aggregateType, "aggregateType");
  requireString(aggregateId, "aggregateId");
  requireString(correlationId, "correlationId");
  requireString(causationId, "causationId");

  if (!isPlainObject(payload)) fail("payload must be a plain object.");
  if (!isPlainObject(metadata)) fail("metadata must be a plain object.");

  const event = {
    eventId,
    eventType,
    version,
    occurredAt,
    publisher,
    aggregateType,
    aggregateId,
    correlationId,
    causationId,
    payload: payload,
    metadata: metadata,
  };

  return deepFreeze(event);
}

