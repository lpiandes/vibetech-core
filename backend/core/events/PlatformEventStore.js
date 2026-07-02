import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { PlatformEventBuilder } from "./PlatformEventBuilder.js";
import { validatePlatformEvent } from "./PlatformEventValidator.js";
import { computePlatformEventMetrics } from "./PlatformEventMetrics.js";
import { validatePlatformEventStore } from "./PlatformEventStoreValidator.js";

function fail(message) {
  throw new Error(`PlatformEventStore: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

const EMPTY_ARRAY = deepFreeze([]);

function buildIndexes(events) {
  const byType = {};
  const byPublisher = {};
  const byAggregate = {};

  for (const e of events) {
    const type = String(e.eventType);
    const pub = String(e.publisher);
    const agg = String(e.aggregateId);

    (byType[type] ??= []).push(e);
    (byPublisher[pub] ??= []).push(e);
    (byAggregate[agg] ??= []).push(e);
  }

  return deepFreeze({
    byType,
    byPublisher,
    byAggregate,
  });
}

export class PlatformEventStore {
  constructor({ seed, nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

    const initialEvents = typeof seed === "function" ? safeArray(seed({ nowISO: this.nowISO })) : [];
    for (const e of initialEvents) validatePlatformEvent(e);

    const events = safeArray(initialEvents).slice();
    const indexes = buildIndexes(events);
    const metrics = computePlatformEventMetrics(events);

    this._state = deepFreeze({
      events,
      indexes,
      metrics,
    });

    validatePlatformEventStore(this);
  }

  getEvents() {
    return this._state.events;
  }

  getEvent(id) {
    const sid = String(id);
    return this._state.events.find((e) => String(e.eventId) === sid) ?? null;
  }

  getEventsByType(type) {
    const t = String(type);
    return this._state.indexes.byType[t] ?? EMPTY_ARRAY;
  }

  getEventsByAggregate(aggregateId) {
    const aid = String(aggregateId);
    return this._state.indexes.byAggregate[aid] ?? EMPTY_ARRAY;
  }

  getEventsByPublisher(publisher) {
    const p = String(publisher);
    return this._state.indexes.byPublisher[p] ?? EMPTY_ARRAY;
  }

  append(eventOrEnvelope) {
    // Store only immutable canonical PlatformEvents.
    if (!eventOrEnvelope || typeof eventOrEnvelope !== "object") fail("append requires an event object.");

    // If a raw envelope is passed, assume it already matches the canonical fields.
    const event = eventOrEnvelope;
    validatePlatformEvent(event);

    const prev = this._state;
    const nextEvents = [...prev.events, event];
    const indexes = buildIndexes(nextEvents);
    const metrics = computePlatformEventMetrics(nextEvents);

    // Append-only: historical events remain the same object references.
    this._state = deepFreeze({
      ...prev,
      events: nextEvents,
      indexes,
      metrics,
    });

    validatePlatformEventStore(this);
    return this._state;
  }

  static builder({ nowISO } = {}) {
    return new PlatformEventBuilder({ nowISO });
  }
}

