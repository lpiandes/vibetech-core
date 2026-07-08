import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  COMMUNICATION_OS_PUBLISHER_ID,
  COMMUNICATION_PLATFORM_EVENT_AGGREGATE_TYPE,
} from "./CommunicationPlatformEventDefaults.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Publishes communication lifecycle facts to the platform event bus for analytics and timelines.
 */
export class CommunicationPlatformEventPublisher {
  constructor({ platformEventBus, platformEventStore, nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    this.bus = platformEventBus ?? null;
    this.store = platformEventStore ?? null;
    this.nowISO = String(nowISO);
  }

  publishCommunicationSent({ message, occurredAt, metadata } = {}) {
    const messageId = safeString(message?.id);
    const effectiveOccurredAt = safeString(occurredAt ?? message?.sentAt ?? message?.updatedAt ?? this.nowISO);
    const event = deepFreeze({
      eventId: `evt_communication_sent_${messageId}_${effectiveOccurredAt}`,
      eventType: "COMMUNICATION_SENT",
      version: 1,
      occurredAt: effectiveOccurredAt,
      publisher: COMMUNICATION_OS_PUBLISHER_ID,
      aggregateType: COMMUNICATION_PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: messageId || "communication_message",
      correlationId: safeString(message?.threadId) || messageId,
      causationId: messageId || "communication_message",
      payload: deepFreeze({
        communicationMessageId: messageId,
        communicationThreadId: safeString(message?.threadId) || null,
        channel: safeString(message?.channel) || null,
        direction: safeString(message?.direction) || null,
        status: safeString(message?.status) || "sent",
        sentAt: effectiveOccurredAt,
      }),
      metadata: deepFreeze(metadata && typeof metadata === "object" ? metadata : {}),
    });

    if (this.store?.append) this.store.append(event);
    if (this.bus?.dispatch) this.bus.dispatch(event);
    return event;
  }
}
