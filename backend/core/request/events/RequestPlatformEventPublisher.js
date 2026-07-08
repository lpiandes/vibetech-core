import { REQUEST_OS_PUBLISHER_ID } from "./RequestPlatformEventDefaults.js";

import { mapRequestConvertedToPlatformEventInput } from "./RequestPlatformEventMapper.js";
import { mapRequestReceivedToPlatformEventInput } from "./RequestPlatformEventMapper.js";
import { validateRequestConvertedRequestToPlatformEvent } from "./RequestPlatformEventValidator.js";
import { validateRequestReceivedRequestToPlatformEvent } from "./RequestPlatformEventValidator.js";
import { createPlatformEventPublicationResult } from "../../events/publishing/PlatformEventPublicationResult.js";
import { PUBLISHATION_STATUSES } from "../../events/publishing/PlatformEventPublisherDefaults.js";

function fail(message) {
  throw new Error(`RequestPlatformEventPublisher: ${message}`);
}

/**
 * Wrapper that lets Request OS publish REQUEST_CONVERTED facts via the PlatformEventPublisher framework,
 * without requiring any direct knowledge of subscribers.
 *
 * This integration is intentionally *not* wired into RequestRuntime.applyEvent; it is invoked explicitly after conversion.
 */
export class RequestPlatformEventPublisher {
  constructor({ platformEventPublisher } = {}) {
    if (!platformEventPublisher) fail("platformEventPublisher required.");
    this.platformEventPublisher = platformEventPublisher;
  }

  publishRequestReceived({ request, receivedAtISO, sourceEventId, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const publisherId = String(this.platformEventPublisher.publisherId ?? REQUEST_OS_PUBLISHER_ID);
    const requestId = request?.id ? String(request.id) : "evt_unknown";
    const eventType = "REQUEST_RECEIVED";
    const publicationId = `${publisherId}:${requestId}:${nowISO}`;

    try {
      validateRequestReceivedRequestToPlatformEvent({
        request,
        receivedAtISO,
        sourceEventId,
      });

      const eventInput = mapRequestReceivedToPlatformEventInput({
        request,
        receivedAtISO,
        sourceEventId,
      });

      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { requestOS: true, publisherId: REQUEST_OS_PUBLISHER_ID } },
      });
    } catch (err) {
      const errors = [String(err?.message ?? err)];
      return createPlatformEventPublicationResult({
        publicationId,
        eventId: requestId,
        eventType,
        publisherId,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors,
        metadata: metadata ?? {},
      });
    }
  }

  publishRequestConverted({ requestRuntime, requestConvertedEvent, convertedRequest, convertedAtISO, metadata } = {}) {
    const nowISO = String(this.platformEventPublisher.nowISO ?? "2026-07-01T00:00:00.000Z");
    const publisherId = String(this.platformEventPublisher.publisherId ?? REQUEST_OS_PUBLISHER_ID);
    const eventId = requestConvertedEvent?.id ? String(requestConvertedEvent.id) : "evt_unknown";
    const eventType = "REQUEST_CONVERTED";
    const publicationId = `${publisherId}:${eventId}:${nowISO}`;

    try {
      // Validate mapping compatibility.
      validateRequestConvertedRequestToPlatformEvent({
        requestRuntime,
        requestConvertedEvent,
        convertedRequest,
        convertedAtISO,
      });

      const eventInput = mapRequestConvertedToPlatformEventInput({
        requestRuntime,
        requestConvertedEvent,
        convertedRequest,
        convertedAtISO,
      });

      // Publish through the platform publisher framework.
      return this.platformEventPublisher.publish({
        eventInput,
        metadata: metadata ?? { derivedFrom: { requestOS: true, publisherId: REQUEST_OS_PUBLISHER_ID } },
      });
    } catch (err) {
      const errors = [String(err?.message ?? err)];
      return createPlatformEventPublicationResult({
        publicationId,
        eventId,
        eventType,
        publisherId,
        publishedAt: nowISO,
        stored: false,
        dispatched: false,
        dispatchReport: null,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors,
        metadata: metadata ?? {},
      });
    }
  }
}

