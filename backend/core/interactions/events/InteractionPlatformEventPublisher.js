import { INTERACTION_OS_PUBLISHER_ID, PLATFORM_EVENT_AGGREGATE_TYPE } from "./InteractionPlatformEventDefaults.js";

import { createPlatformEventPublicationResult } from "../../events/publishing/PlatformEventPublicationResult.js";
import { PUBLISHATION_STATUSES } from "../../events/publishing/PlatformEventPublisherDefaults.js";
import { PlatformEventPublisher } from "../../events/publishing/PlatformEventPublisher.js";

function fail(message) {
  throw new Error(`InteractionPlatformEventPublisher: ${message}`);
}

function deterministicEventId({ eventType, interactionId, timestampISO }) {
  return `evt_${eventType.toLowerCase()}_${String(interactionId)}_${String(timestampISO)}`;
}

export class InteractionPlatformEventPublisher {
  constructor({ platformEventPublisher } = {}) {
    if (!platformEventPublisher) fail("platformEventPublisher required.");
    this.platformEventPublisher = platformEventPublisher;
  }

  publishInteractionRecorded({ interaction, recordedAtISO, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const eventType = "INTERACTION_RECORDED";
    const interactionId = interaction?.id ?? "";
    const occurredAt = String(recordedAtISO ?? interaction?.occurredAt ?? nowISO);
    const eventInput = {
      eventId: deterministicEventId({ eventType, interactionId, timestampISO: occurredAt }),
      eventType,
      aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: String(interactionId),
      occurredAt,
      publisher: INTERACTION_OS_PUBLISHER_ID,
      correlationId: String(interactionId),
      causationId: String(interactionId),
      payload: {
        interaction: interaction ?? {},
      },
      metadata: {
        derivedFrom: { interactionId: String(interactionId) },
      },
    };

    try {
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { interactionOS: true } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${eventType}_${interactionId}_${nowISO}`,
        eventId: eventInput.eventId,
        eventType,
        publisherId: INTERACTION_OS_PUBLISHER_ID,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: [String(err?.message ?? err)],
        metadata: metadata ?? {},
      });
    }
  }

  publishInteractionOutcomeRecorded({ interactionId, outcome, nextStep, followUpAt, occurredAtISO, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const eventType = "INTERACTION_OUTCOME_RECORDED";
    const atISO = String(occurredAtISO ?? nowISO);
    const eventInput = {
      eventId: deterministicEventId({ eventType, interactionId, timestampISO: atISO }),
      eventType,
      aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: String(interactionId),
      occurredAt: atISO,
      publisher: INTERACTION_OS_PUBLISHER_ID,
      correlationId: String(interactionId),
      causationId: String(interactionId),
      payload: {
        interactionId: String(interactionId),
        outcome: outcome ?? null,
        nextStep: nextStep ?? null,
        followUpAt: followUpAt ?? null,
      },
      metadata: {
        derivedFrom: { interactionId: String(interactionId) },
      },
    };

    try {
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { interactionOS: true } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${eventType}_${interactionId}_${nowISO}`,
        eventId: eventInput.eventId,
        eventType,
        publisherId: INTERACTION_OS_PUBLISHER_ID,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: [String(err?.message ?? err)],
        metadata: metadata ?? {},
      });
    }
  }

  publishFollowUpScheduled({ interactionId, followUpAtISO, occurredAtISO, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const eventType = "FOLLOW_UP_SCHEDULED";
    const atISO = String(occurredAtISO ?? nowISO);
    const eventInput = {
      eventId: deterministicEventId({ eventType, interactionId, timestampISO: atISO }),
      eventType,
      aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: String(interactionId),
      occurredAt: atISO,
      publisher: INTERACTION_OS_PUBLISHER_ID,
      correlationId: String(interactionId),
      causationId: String(interactionId),
      payload: {
        interactionId: String(interactionId),
        followUpAt: String(followUpAtISO ?? ""),
      },
      metadata: {
        derivedFrom: { interactionId: String(interactionId) },
      },
    };

    try {
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { interactionOS: true } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${eventType}_${interactionId}_${nowISO}`,
        eventId: eventInput.eventId,
        eventType,
        publisherId: INTERACTION_OS_PUBLISHER_ID,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: [String(err?.message ?? err)],
        metadata: metadata ?? {},
      });
    }
  }
}
