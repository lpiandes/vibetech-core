import { AUTOMATION_OS_PUBLISHER_ID, AUTOMATION_PLATFORM_EVENT_VERSION, PLATFORM_EVENT_AGGREGATE_TYPE } from "./AutomationPlatformEventDefaults.js";
import { createPlatformEventPublicationResult } from "../../events/publishing/PlatformEventPublicationResult.js";
import { PUBLISHATION_STATUSES } from "../../events/publishing/PlatformEventPublisherDefaults.js";
import { PlatformEventPublisher } from "../../events/publishing/PlatformEventPublisher.js";

function fail(message) {
  throw new Error(`AutomationPlatformEventPublisher: ${message}`);
}

function deterministicEventId({ eventType, runId, timestampISO }) {
  return `evt_${String(eventType).toLowerCase()}_${String(runId)}_${String(timestampISO)}`;
}

export class AutomationPlatformEventPublisher {
  constructor({ platformEventPublisher } = {}) {
    if (!platformEventPublisher) fail("platformEventPublisher required.");
    if (!(platformEventPublisher instanceof PlatformEventPublisher)) {
      // Allow testing/mocking; runtime will still validate event shape.
    }
    this.platformEventPublisher = platformEventPublisher;
  }

  publishAutomationRunStarted({ runId, automationId, occurredAtISO, triggerEventId, metadata } = {}) {
    return this._publishAutomationRunEvent({
      eventType: "AUTOMATION_RUN_STARTED",
      runId,
      automationId,
      occurredAtISO,
      triggerEventId,
      metadata,
    });
  }

  publishAutomationRunCompleted({ runId, automationId, occurredAtISO, triggerEventId, metadata } = {}) {
    return this._publishAutomationRunEvent({
      eventType: "AUTOMATION_RUN_COMPLETED",
      runId,
      automationId,
      occurredAtISO,
      triggerEventId,
      metadata,
    });
  }

  publishAutomationRunFailed({ runId, automationId, occurredAtISO, triggerEventId, metadata } = {}) {
    return this._publishAutomationRunEvent({
      eventType: "AUTOMATION_RUN_FAILED",
      runId,
      automationId,
      occurredAtISO,
      triggerEventId,
      metadata,
    });
  }

  _publishAutomationRunEvent({ eventType, runId, automationId, occurredAtISO, triggerEventId, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const atISO = String(occurredAtISO ?? nowISO);
    const rId = String(runId ?? "");
    const aId = String(automationId ?? "");
    const tid = String(triggerEventId ?? "");

    if (!rId || !aId) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${String(eventType)}_${rId}_${nowISO}`,
        eventId: deterministicEventId({ eventType, runId: rId || "unknown", timestampISO: atISO }),
        eventType: String(eventType),
        publisherId: AUTOMATION_OS_PUBLISHER_ID,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: ["runId and automationId are required."],
        metadata: metadata ?? {},
      });
    }

    const eventInput = {
      eventId: deterministicEventId({ eventType, runId: rId, timestampISO: atISO }),
      eventType: String(eventType),
      version: AUTOMATION_PLATFORM_EVENT_VERSION,
      occurredAt: atISO,
      publisher: AUTOMATION_OS_PUBLISHER_ID,
      aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: aId,
      correlationId: tid,
      causationId: rId,
      payload: {
        runId: rId,
        automationId: aId,
        triggerEventId: tid,
      },
      metadata: {
        derivedFrom: { runId: rId, automationId: aId, triggerEventId: tid },
      },
    };

    try {
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { automationOS: true } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${String(eventType)}_${rId}_${nowISO}`,
        eventId: eventInput.eventId,
        eventType: String(eventType),
        publisherId: AUTOMATION_OS_PUBLISHER_ID,
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
