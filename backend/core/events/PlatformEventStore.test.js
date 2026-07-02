import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "./PlatformEventBuilder.js";
import { PlatformEventStore } from "./PlatformEventStore.js";
import { validatePlatformEvent } from "./PlatformEventValidator.js";

const NOW1 = "2026-07-01T00:00:00.000Z";
const NOW2 = "2026-07-02T00:00:00.000Z";

function baseEventInput({ overrides = {} } = {}) {
  return {
    eventId: "evt_1",
    eventType: "REQUEST_RECEIVED",
    version: 1,
    occurredAt: NOW1,
    publisher: "RequestOS",
    aggregateType: "Request",
    aggregateId: "req_1",
    correlationId: "corr_1",
    causationId: "cause_1",
    payload: { requestId: "req_1" },
    metadata: {},
    ...overrides,
  };
}

test("PlatformEventStore: creation yields frozen empty store + deterministic metrics/indexes", () => {
  const store = new PlatformEventStore();
  assert.ok(store);
  assert.ok(Object.isFrozen(store._state));
  assert.deepEqual(store.getEvents(), []);
  assert.deepEqual(store.getEventsByType("NOPE"), []);
  assert.deepEqual(store.getEventsByPublisher("NOPE"), []);
  assert.deepEqual(store.getEventsByAggregate("NOPE"), []);
  assert.deepEqual(store._state.metrics.totalEvents, 0);
  assert.deepEqual(store._state.metrics.eventsByType, {});
});

test("PlatformEvent: builder creates canonical deep-frozen event", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW1 });
  const e = builder.build(baseEventInput({ overrides: { eventId: "evt_1", eventType: "REQUEST_RECEIVED" } }));
  assert.equal(e.eventId, "evt_1");
  assert.equal(e.eventType, "REQUEST_RECEIVED");
  assert.ok(Object.isFrozen(e));
  assert.ok(Object.isFrozen(e.payload));
  assert.ok(Object.isFrozen(e.metadata));
  assert.deepEqual(validatePlatformEvent(e), { ok: true });
});

test("Validation: invalid eventType or occurredAt throws", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW1 });

  assert.throws(() => {
    builder.build(baseEventInput({ overrides: { eventId: "evt_bad_1", eventType: "request_received" } }));
  }, /eventType invalid/i);

  assert.throws(() => {
    builder.build(baseEventInput({ overrides: { eventId: "evt_bad_2", occurredAt: "not-iso" } }));
  }, /occurredAt/i);
});

test("Append ordering: append-only history preserves order and event object references", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW1 });
  const store = new PlatformEventStore();

  const e1 = builder.build(baseEventInput({ overrides: { eventId: "evt_1", occurredAt: NOW1, aggregateId: "req_1", payload: { requestId: "req_1" } } }));
  const e2 = builder.build(
    baseEventInput({
      overrides: { eventId: "evt_2", occurredAt: NOW2, aggregateId: "req_2", payload: { requestId: "req_2" }, eventType: "REQUEST_UPDATED", publisher: "RequestOS" },
    }),
  );

  const prevStoreState = store._state;

  store.append(e1);
  store.append(e2);

  assert.deepEqual(store.getEvents().map((x) => x.eventId), ["evt_1", "evt_2"]);

  // Append must preserve object references (store stores canonical immutable events).
  assert.equal(store.getEvent("evt_1"), e1);
  assert.equal(store.getEvent("evt_2"), e2);

  // Historical event objects remain frozen.
  assert.ok(Object.isFrozen(prevStoreState));
  assert.ok(Object.isFrozen(e1));
  assert.ok(Object.isFrozen(e2));
});

test("Indexes + metrics: getEventsByType/publisher/aggregate + computed latest timestamp", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW1 });
  const store = new PlatformEventStore();

  const e1 = builder.build(baseEventInput({ overrides: { eventId: "evt_1", occurredAt: NOW1, eventType: "REQUEST_RECEIVED", aggregateId: "req_1", publisher: "RequestOS" } }));
  const e2 = builder.build(baseEventInput({ overrides: { eventId: "evt_2", occurredAt: NOW2, eventType: "REQUEST_RECEIVED", aggregateId: "req_1", publisher: "RequestOS" } }));
  const e3 = builder.build(
    baseEventInput({
      overrides: { eventId: "evt_3", occurredAt: NOW2, eventType: "WORK_CREATED", aggregateId: "work_1", publisher: "WorkOS", payload: { workId: "work_1" } },
    }),
  );

  store.append(e1);
  store.append(e2);
  store.append(e3);

  assert.deepEqual(store.getEventsByType("REQUEST_RECEIVED").map((x) => x.eventId), ["evt_1", "evt_2"]);
  assert.deepEqual(store.getEventsByAggregate("req_1").map((x) => x.eventId), ["evt_1", "evt_2"]);
  assert.deepEqual(store.getEventsByPublisher("WorkOS").map((x) => x.eventId), ["evt_3"]);

  assert.equal(store._state.metrics.totalEvents, 3);
  assert.deepEqual(store._state.metrics.eventsByType, { REQUEST_RECEIVED: 2, WORK_CREATED: 1 });
  assert.deepEqual(store._state.metrics.eventsByAggregate, { req_1: 2, work_1: 1 });
  assert.equal(store._state.metrics.latestEventTimestamp, NOW2);
});

test("Immutability: store state and nested indexes/metrics are frozen", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW1 });
  const store = new PlatformEventStore();
  const e1 = builder.build(baseEventInput({ overrides: { eventId: "evt_1", payload: { requestId: "req_1" } } }));
  store.append(e1);

  assert.ok(Object.isFrozen(store._state));
  assert.ok(Object.isFrozen(store._state.events));
  assert.ok(Object.isFrozen(store._state.indexes));
  assert.ok(Object.isFrozen(store._state.metrics));
  assert.ok(Object.isFrozen(store.getEvents()));
});

