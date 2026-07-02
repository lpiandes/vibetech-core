import { PlatformEventBuilder } from "../PlatformEventBuilder.js";
import { validatePlatformEvent } from "../PlatformEventValidator.js";

import { createPlatformEventPublicationResult } from "./PlatformEventPublicationResult.js";
import {
  PUBLISHATION_STATUSES,
} from "./PlatformEventPublisherDefaults.js";

import {
  validatePublisherShape,
  validateAllowedEventType,
  validateEventInputShape,
  validateCanonicalEventBeforePublish,
  validateDispatchReportShapeOrThrow,
  validateStoreAppendResult,
  validatePublicationResultShape,
} from "./PlatformEventPublisherValidator.js";

function fail(message) {
  throw new Error(`PlatformEventPublisher: ${message}`);
}

function deterministicPublicationId({ publisherId, eventId, nowISO }) {
  if (!publisherId || !eventId || !nowISO) return "";
  return `${publisherId}:${eventId}:${String(nowISO)}`;
}

export class PlatformEventPublisher {
  constructor({ publisherRegistry, publisherId, store, bus, nowISO } = {}) {
    if (!publisherRegistry) fail("publisherRegistry required.");
    if (!publisherId) fail("publisherId required.");
    if (!store) fail("store required.");
    if (!bus) fail("bus required.");

    const publisher = publisherRegistry.getPublisher?.(publisherId);
    if (!publisher) fail(`publisherId not found: ${String(publisherId)}`);
    validatePublisherShape(publisher);

    this.publisherRegistry = publisherRegistry;
    this.publisher = publisher;
    this.publisherId = String(publisherId);
    this.store = store;
    this.bus = bus;
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
    this.builder = new PlatformEventBuilder({ nowISO: this.nowISO });
  }

  publish({ eventInput, metadata } = {}) {
    const errors = [];
    const eventId = eventInput?.eventId ? String(eventInput.eventId) : "";
    const publicationId = deterministicPublicationId({
      publisherId: this.publisherId,
      eventId,
      nowISO: this.nowISO,
    });

    const baseResultArgs = {
      publicationId: publicationId || "pub_unknown",
      eventId: eventInput?.eventId ? String(eventInput.eventId) : "",
      eventType: eventInput?.eventType ? String(eventInput.eventType) : "",
      publisherId: this.publisherId,
      publishedAt: this.nowISO,
      stored: false,
      dispatched: false,
      dispatchReport: null,
      status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
      errors: [],
      metadata: metadata ?? {},
    };

    // 1) Validate event input + allowed event type.
    try {
      validateEventInputShape({ eventInput });
      validateAllowedEventType({ publisher: this.publisher, eventType: eventInput.eventType });

      // Basic event object canonicality: we build below and validate with PlatformEventValidator.
    } catch (err) {
      errors.push(String(err?.message ?? err));
      return createPlatformEventPublicationResult({
        ...baseResultArgs,
        stored: false,
        dispatched: false,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        errors,
      });
    }

    // 2) Build canonical PlatformEvent and validate it.
    let platformEvent;
    try {
      // Ensure deterministic builder inputs.
      const eventType = String(eventInput.eventType);
      const aggregateType = String(eventInput.aggregateType);
      const aggregateId = String(eventInput.aggregateId);
      const correlationId = String(eventInput.correlationId ?? "corr_unknown");
      const causationId = String(eventInput.causationId ?? "cause_unknown");

      platformEvent = this.builder.build({
        eventId: String(eventInput.eventId),
        eventType,
        version: this.publisher.version,
        occurredAt: eventInput.occurredAt ? String(eventInput.occurredAt) : undefined,
        publisher: this.publisherId,
        aggregateType,
        aggregateId,
        correlationId,
        causationId,
        payload: eventInput.payload,
        metadata: eventInput.metadata ?? {},
      });

      // Canonical event validation (deep frozen + field constraints).
      validateCanonicalEventBeforePublish(platformEvent);
      validatePlatformEvent(platformEvent);
    } catch (err) {
      errors.push(String(err?.message ?? err));
      return createPlatformEventPublicationResult({
        ...baseResultArgs,
        status: PUBLISHATION_STATUSES.FAILED_VALIDATION,
        stored: false,
        dispatched: false,
        errors,
        eventType: eventInput?.eventType ? String(eventInput.eventType) : "",
        eventId: eventInput?.eventId ? String(eventInput.eventId) : "",
      });
    }

    // 3) Append to store.
    try {
      const appendResult = this.store.append(platformEvent);
      validateStoreAppendResult(appendResult);
    } catch (err) {
      errors.push(String(err?.message ?? err));
      return createPlatformEventPublicationResult({
        ...baseResultArgs,
        stored: false,
        dispatched: false,
        status: PUBLISHATION_STATUSES.FAILED_STORE,
        errors,
        eventType: eventInput?.eventType ? String(eventInput.eventType) : platformEvent.eventType,
        eventId: eventInput?.eventId ? String(eventInput.eventId) : platformEvent.eventId,
      });
    }

    // 4) Dispatch through bus.
    let dispatchReport;
    let dispatched = false;
    let status = PUBLISHATION_STATUSES.FAILED_DISPATCH;
    try {
      dispatchReport = this.bus.dispatch(platformEvent, { dispatchedAtISO: this.nowISO });
      validateDispatchReportShapeOrThrow(dispatchReport);
      dispatched = true;
      status = PUBLISHATION_STATUSES.PUBLISHED;
    } catch (err) {
      errors.push(String(err?.message ?? err));
      dispatched = false;
      status = dispatchReport ? PUBLISHATION_STATUSES.STORED_NOT_DISPATCHED : PUBLISHATION_STATUSES.FAILED_DISPATCH;
    }

    const result = createPlatformEventPublicationResult({
      ...baseResultArgs,
      status,
      stored: true,
      dispatched,
      dispatchReport,
      errors,
      eventType: String(platformEvent.eventType),
      eventId: String(platformEvent.eventId),
      publisherId: this.publisherId,
      publishedAt: this.nowISO,
      metadata: metadata ?? {},
    });

    validatePublicationResultShape(result);
    return result;
  }
}

