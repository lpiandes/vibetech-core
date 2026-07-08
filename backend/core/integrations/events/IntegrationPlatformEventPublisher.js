import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { INTEGRATION_OS_PUBLISHER_ID } from "./IntegrationPlatformEventDefaults.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Publishes integration lifecycle facts to the platform event bus for analytics and timelines.
 * Never includes credentials or secrets in payloads.
 */
export class IntegrationPlatformEventPublisher {
  constructor({ platformEventBus, platformEventStore, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    this.bus = platformEventBus ?? null;
    this.store = platformEventStore ?? null;
    this.nowISO = String(nowISO);
  }

  publish({ eventId, eventType, aggregateId, payload, metadata, occurredAt } = {}) {
    const aggId = safeString(aggregateId) || safeString(payload?.externalEventId) || safeString(payload?.connectionId) || "integration";
    const effectiveOccurredAt = safeString(occurredAt ?? this.nowISO);
    const event = deepFreeze({
      eventId: safeString(eventId) || `evt_${safeString(eventType).toLowerCase()}_${aggId}_${effectiveOccurredAt}`,
      eventType: safeString(eventType),
      version: 1,
      occurredAt: safeString(occurredAt ?? this.nowISO),
      publisher: INTEGRATION_OS_PUBLISHER_ID,
      aggregateType: "connection",
      aggregateId: aggId,
      correlationId: aggId,
      causationId: aggId,
      payload: deepFreeze(payload && typeof payload === "object" ? payload : {}),
      metadata: deepFreeze(metadata && typeof metadata === "object" ? metadata : {}),
    });

    if (this.store?.append) this.store.append(event);
    if (this.bus?.dispatch) this.bus.dispatch(event);
    return event;
  }
}
