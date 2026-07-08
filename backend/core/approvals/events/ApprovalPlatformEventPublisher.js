import {
  APPROVAL_OS_PUBLISHER_ID,
  APPROVAL_PLATFORM_EVENT_VERSION,
  PLATFORM_EVENT_AGGREGATE_TYPE,
} from "./ApprovalPlatformEventDefaults.js";
import { createPlatformEventPublicationResult } from "../../events/publishing/PlatformEventPublicationResult.js";
import { PUBLISHATION_STATUSES } from "../../events/publishing/PlatformEventPublisherDefaults.js";

function fail(message) {
  throw new Error(`ApprovalPlatformEventPublisher: ${message}`);
}

function deterministicEventId({ eventType, approvalId, timestampISO }) {
  return `evt_${String(eventType).toLowerCase()}_${String(approvalId)}_${String(timestampISO)}`;
}

export class ApprovalPlatformEventPublisher {
  constructor({ platformEventPublisher } = {}) {
    if (!platformEventPublisher) fail("platformEventPublisher required.");
    this.platformEventPublisher = platformEventPublisher;
  }

  publishApprovalRequested({ approvalId, requestType, occurredAtISO, metadata } = {}) {
    return this._publish({
      eventType: "APPROVAL_REQUESTED",
      approvalId,
      occurredAtISO,
      payload: { approvalId: String(approvalId), requestType: String(requestType ?? "automation_action") },
      metadata,
    });
  }

  publishApprovalGranted({ approvalId, occurredAtISO, metadata } = {}) {
    return this._publish({
      eventType: "APPROVAL_GRANTED",
      approvalId,
      occurredAtISO,
      payload: { approvalId: String(approvalId) },
      metadata,
    });
  }

  publishApprovalRejected({ approvalId, occurredAtISO, metadata } = {}) {
    return this._publish({
      eventType: "APPROVAL_REJECTED",
      approvalId,
      occurredAtISO,
      payload: { approvalId: String(approvalId) },
      metadata,
    });
  }

  _publish({ eventType, approvalId, occurredAtISO, payload, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const atISO = String(occurredAtISO ?? nowISO);
    const aId = String(approvalId ?? "");

    if (!aId) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${eventType}_${nowISO}`,
        eventId: "",
        eventType: String(eventType),
        publisherId: APPROVAL_OS_PUBLISHER_ID,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors: ["approvalId required."],
        metadata: metadata ?? {},
      });
    }

    const eventInput = {
      eventId: deterministicEventId({ eventType, approvalId: aId, timestampISO: atISO }),
      eventType: String(eventType),
      version: APPROVAL_PLATFORM_EVENT_VERSION,
      occurredAt: atISO,
      publisher: APPROVAL_OS_PUBLISHER_ID,
      aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
      aggregateId: aId,
      correlationId: aId,
      causationId: aId,
      payload,
      metadata: { derivedFrom: { approvalId: aId } },
    };

    try {
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { approvalOS: true } },
      });
    } catch (err) {
      return createPlatformEventPublicationResult({
        publicationId: `pub_unknown_${eventType}_${aId}_${nowISO}`,
        eventId: eventInput.eventId,
        eventType: String(eventType),
        publisherId: APPROVAL_OS_PUBLISHER_ID,
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
