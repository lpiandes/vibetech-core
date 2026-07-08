import {
  PLATFORM_EVENT_AGGREGATE_TYPE,
} from "./RequestPlatformEventDefaults.js";

function fail(message) {
  throw new Error(`RequestPlatformEventMapper: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requirePlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} required plain object.`);
  return value;
}

function safeNullToStringOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  // allow numeric/string coercion only if already safe.
  return String(v);
}

function deterministicEventId({ requestId, convertedAtISO }) {
  return `evt_request_converted_${String(requestId)}_${String(convertedAtISO)}`;
}

function deterministicReceivedEventId({ requestId, receivedAtISO }) {
  return `evt_request_received_${String(requestId)}_${String(receivedAtISO)}`;
}

/**
 * Maps a received request into a canonical PlatformEvent input for REQUEST_RECEIVED.
 */
export function mapRequestReceivedToPlatformEventInput({ request, receivedAtISO, sourceEventId } = {}) {
  if (!request) fail("request required.");

  const timestampISO = receivedAtISO ?? request.receivedAt ?? request.createdAt ?? null;
  if (!timestampISO || typeof timestampISO !== "string") fail("receivedAtISO (timestampISO) required.");

  const requestId = requireString(String(request.id), "requestId");

  const payload = {
    requestId,
    title: String(request.title),
    description: String(request.description),
    requestType: String(request.requestType),
    priority: String(request.priority),
    channel: String(request.channel),
    source: String(request.source),
    requester: String(request.requester),
    receivedAt: String(timestampISO),
    metadata: request.metadata && typeof request.metadata === "object" ? request.metadata : {},
  };

  requirePlainObject(payload.metadata, "payload.metadata");

  const correlationId = String(requestId);
  const causationId = String(sourceEventId ?? `request_received_${requestId}_${timestampISO}`);

  return {
    eventId: deterministicReceivedEventId({ requestId, receivedAtISO: timestampISO }),
    eventType: "REQUEST_RECEIVED",
    aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
    aggregateId: String(requestId),
    occurredAt: String(timestampISO),
    correlationId,
    causationId,
    payload,
    metadata: {
      derivedFrom: {
        requestId: String(requestId),
      },
    },
  };
}

/**
 * Maps a RequestRuntime REQUEST_CONVERTED event + current RequestRuntime state into
 * a canonical PlatformEvent *input* for PlatformEventPublisher.
 *
 * NOTE: PlatformEventPublisher will set `publisher` from the publisher contract.
 */
export function mapRequestConvertedToPlatformEventInput({
  requestRuntime,
  requestConvertedEvent,
  convertedRequest,
  convertedAtISO,
} = {}) {
  if (!requestConvertedEvent && !convertedRequest) fail("Either requestConvertedEvent or convertedRequest must be provided.");

  const ev = requestConvertedEvent;
  const timestampISO = convertedAtISO ?? ev?.timestampISO ?? null;
  if (!timestampISO || typeof timestampISO !== "string") fail("convertedAtISO (timestampISO) required.");

  const requestId = convertedRequest?.id ?? ev?.payload?.requestId;
  requireString(String(requestId), "requestId");

  const req = convertedRequest ?? requestRuntime?.getRequest?.(String(requestId));
  if (!req) fail(`request not found for requestId: ${String(requestId)}`);

  // Payload contract expects these fields.
  const payload = {
    requestId: String(req.id),
    title: String(req.title),
    description: String(req.description),
    requestType: String(req.requestType),
    priority: String(req.priority),
    channel: String(req.channel),
    source: String(req.source),
    requester: String(req.requester),
    convertedAt: String(timestampISO),
    assignedWorkId: safeNullToStringOrNull(req.assignedWorkId),
    assignedTeamMemberId: safeNullToStringOrNull(req.assignedTeamMemberId),
    metadata: req.metadata && typeof req.metadata === "object" ? req.metadata : {},
  };

  requirePlainObject(payload.metadata, "payload.metadata");

  // Deterministic correlation/causation ids (best-effort from the request event).
  const correlationId = String(ev?.payload?.requestId ?? req.id);
  const causationId = String(ev?.id ?? `request_converted_${req.id}_${timestampISO}`);

  const eventInput = {
    eventId: deterministicEventId({ requestId: req.id, convertedAtISO: timestampISO }),
    eventType: "REQUEST_CONVERTED",
    aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
    aggregateId: String(req.id),
    occurredAt: String(timestampISO),
    correlationId,
    causationId,
    payload,
    metadata: {
      derivedFrom: {
        requestId: String(req.id),
      },
    },
  };

  return eventInput;
}

