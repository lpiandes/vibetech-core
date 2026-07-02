import { validatePlatformEventCanonical } from "../bus/PlatformEventBusValidator.js";

import { validatePlatformEvent } from "../PlatformEventValidator.js";

import { validateDispatchReportShape } from "../bus/PlatformEventBusValidator.js";

import { PUBLISHATION_STATUS_LIST } from "./PlatformEventPublisherDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventPublisherValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireFiniteInt(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) {
    fail(`${name} must be finite int >= 0.`);
  }
  return value;
}

export function validatePublisherShape(publisher) {
  if (!publisher || typeof publisher !== "object") fail("publisher required.");
  requireString(publisher.id, "publisher.id");
  requireString(publisher.name, "publisher.name");
  requireString(publisher.operatingSystem, "publisher.operatingSystem");
  if (!Array.isArray(publisher.allowedEventTypes)) fail("publisher.allowedEventTypes must be array.");
  requireFiniteInt(publisher.version ?? 1, "publisher.version");
  if (publisher.metadata !== undefined && !isPlainObject(publisher.metadata)) fail("publisher.metadata must be plain object.");
  return true;
}

export function validateAllowedEventType({ publisher, eventType }) {
  const et = String(eventType);
  const allowed = safeArray(publisher.allowedEventTypes).map((x) => String(x));
  if (!allowed.includes(et)) fail(`eventType not allowed for publisher: ${et}`);
  return et;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function validateEventInputShape({ eventInput }) {
  if (!eventInput || typeof eventInput !== "object") fail("eventInput required.");
  if (typeof eventInput.eventType !== "string" || !eventInput.eventType) fail("eventInput.eventType required string.");
  if (typeof eventInput.aggregateType !== "string" || !eventInput.aggregateType) fail("eventInput.aggregateType required string.");
  if (typeof eventInput.aggregateId !== "string" || !eventInput.aggregateId) fail("eventInput.aggregateId required string.");
  if (typeof eventInput.eventId !== "string" || !eventInput.eventId) fail("eventInput.eventId required string.");
  if (!isPlainObject(eventInput.payload)) fail("eventInput.payload must be plain object.");
  if (eventInput.metadata !== undefined && !isPlainObject(eventInput.metadata)) fail("eventInput.metadata must be plain object.");
  requireString(eventInput.correlationId ?? "corr_unknown", "eventInput.correlationId");
  requireString(eventInput.causationId ?? "cause_unknown", "eventInput.causationId");
  return true;
}

export function validateStoreAppendResult(_appendResult) {
  // Store append returns updated store state. We validate immutability at store layer.
  // Here we just ensure it is an object and frozen.
  if (!_appendResult || typeof _appendResult !== "object") fail("store append result invalid.");
  if (!Object.isFrozen(_appendResult)) fail("store append result must be frozen.");
  return true;
}

export function validateDispatchReportShapeOrThrow(report) {
  if (!report || typeof report !== "object") fail("dispatch report required.");
  // Dispatch report shape is validated inside createPlatformEventDispatchReport.
  validateDispatchReportShape(report);
  return true;
}

export function validatePublicationResultShape(result) {
  if (!result || typeof result !== "object") fail("publication result required.");
  if (!Object.isFrozen(result)) fail("publication result must be frozen.");

  // Validate status.
  if (!PUBLISHATION_STATUS_LIST.includes(String(result.status))) fail(`invalid publication status: ${String(result.status)}`);

  // Minimal existence checks; deeper schema validation is the builder's responsibility.
  requireString(result.publicationId, "publicationId");
  requireString(result.eventId, "eventId");
  requireString(result.eventType, "eventType");
  requireString(result.publisherId, "publisherId");

  if (!Array.isArray(result.errors)) fail("publication result.errors must be array.");
  if (result.metadata !== undefined && !isPlainObject(result.metadata)) fail("publication result.metadata must be plain object.");

  return true;
}

export function validateCanonicalEventBeforePublish(event) {
  validatePlatformEvent(event);
  validatePlatformEventCanonical(event);
  return true;
}

