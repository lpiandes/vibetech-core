import { createPlatformEvent } from "./PlatformEvent.js";

export class PlatformEventBuilder {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  build(input = {}) {
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

    return createPlatformEvent({
      eventId,
      eventType,
      version: version === undefined ? 1 : version,
      occurredAt: occurredAt ?? this.nowISO,
      publisher,
      aggregateType,
      aggregateId,
      correlationId,
      causationId,
      payload: payload ?? {},
      metadata: metadata ?? {},
    });
  }
}

