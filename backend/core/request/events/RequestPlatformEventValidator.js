import { mapRequestConvertedToPlatformEventInput, mapRequestReceivedToPlatformEventInput } from "./RequestPlatformEventMapper.js";

function fail(message) {
  throw new Error(`RequestPlatformEventValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

export function validateRequestReceivedRequestToPlatformEvent({ request, receivedAtISO, sourceEventId } = {}) {
  const eventInput = mapRequestReceivedToPlatformEventInput({
    request,
    receivedAtISO,
    sourceEventId,
  });
  return validateRequestReceivedPlatformEventInput(eventInput);
}

export function validateRequestReceivedPlatformEventInput(input) {
  if (!input || typeof input !== "object") fail("input required object.");
  requireString(input.eventId, "eventId");
  requireString(input.eventType, "eventType");
  requireString(input.aggregateType, "aggregateType");
  requireString(input.aggregateId, "aggregateId");
  requireString(input.occurredAt, "occurredAt");
  requireString(input.correlationId, "correlationId");
  requireString(input.causationId, "causationId");
  if (!isPlainObject(input.payload)) fail("payload required plain object.");
  if (!isPlainObject(input.metadata)) fail("metadata required plain object.");

  const p = input.payload;
  requireString(p.requestId, "payload.requestId");
  requireString(p.title, "payload.title");
  requireString(p.description, "payload.description");
  requireString(p.requestType, "payload.requestType");
  requireString(p.priority, "payload.priority");
  requireString(p.channel, "payload.channel");
  requireString(p.source, "payload.source");
  requireString(p.requester, "payload.requester");
  requireString(p.receivedAt, "payload.receivedAt");
  if (!isPlainObject(p.metadata)) fail("payload.metadata must be plain object.");

  return { ok: true };
}

export function validateRequestConvertedPlatformEventInput(input) {
  if (!input || typeof input !== "object") fail("input required object.");
  requireString(input.eventId, "eventId");
  requireString(input.eventType, "eventType");
  requireString(input.aggregateType, "aggregateType");
  requireString(input.aggregateId, "aggregateId");
  requireString(input.occurredAt, "occurredAt");
  requireString(input.correlationId, "correlationId");
  requireString(input.causationId, "causationId");
  if (!isPlainObject(input.payload)) fail("payload required plain object.");
  if (!isPlainObject(input.metadata)) fail("metadata required plain object.");

  // Payload contract checks (minimal but contract-aligned).
  const p = input.payload;
  requireString(p.requestId, "payload.requestId");
  requireString(p.title, "payload.title");
  requireString(p.description, "payload.description");
  requireString(p.requestType, "payload.requestType");
  requireString(p.priority, "payload.priority");
  requireString(p.channel, "payload.channel");
  requireString(p.source, "payload.source");
  requireString(p.requester, "payload.requester");
  requireString(p.convertedAt, "payload.convertedAt");
  // assignedWorkId/teamMemberId can be null.
  if (!(p.assignedWorkId === null || typeof p.assignedWorkId === "string")) fail("payload.assignedWorkId must be string or null.");
  if (!(p.assignedTeamMemberId === null || typeof p.assignedTeamMemberId === "string")) fail("payload.assignedTeamMemberId must be string or null.");
  if (!isPlainObject(p.metadata)) fail("payload.metadata must be plain object.");

  return { ok: true };
}

export function validateRequestConvertedRequestToPlatformEvent({ requestRuntime, requestConvertedEvent, convertedRequest, convertedAtISO } = {}) {
  const eventInput = mapRequestConvertedToPlatformEventInput({
    requestRuntime,
    requestConvertedEvent,
    convertedRequest,
    convertedAtISO,
  });
  return validateRequestConvertedPlatformEventInput(eventInput);
}

