import { createPlatformEvent } from "./PlatformEvent.js";

function fail(message) {
  throw new Error(`PlatformEventValidator: ${message}`);
}

export function validatePlatformEvent(event) {
  if (!event || typeof event !== "object") fail("event required object.");
  // Validation happens in createPlatformEvent (canonical creation + deep-freeze).
  // Ensure that the provided event already matches canonical constraints by re-building.
  createPlatformEvent({
    eventId: event.eventId,
    eventType: event.eventType,
    version: event.version,
    occurredAt: event.occurredAt,
    publisher: event.publisher,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    payload: event.payload,
    metadata: event.metadata,
  });

  return { ok: true };
}

