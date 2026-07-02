import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "../PlatformEventBuilder.js";
import { PlatformEventStore } from "../PlatformEventStore.js";
import { PlatformEventBus } from "../bus/PlatformEventBus.js";
import { createPlatformEventSubscriber } from "../bus/PlatformEventSubscriber.js";

import { PlatformEventPublisherRegistry } from "./PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "./PlatformEventPublisher.js";
import { PUBLISHATION_STATUSES } from "./PlatformEventPublisherDefaults.js";

const NOW1 = "2026-07-01T00:00:00.000Z";
const NOW2 = "2026-07-02T00:00:00.000Z";

function makePublisher({ id = "request_os", allowedEventTypes = ["REQUEST_RECEIVED"] } = {}) {
  return {
    id,
    name: "Request OS",
    operatingSystem: "RequestOS",
    allowedEventTypes,
    version: 1,
    metadata: {},
  };
}

function makeEventInput({ eventId = "evt_1", eventType = "REQUEST_RECEIVED", overrides = {} } = {}) {
  return {
    eventId,
    eventType,
    version: 1,
    occurredAt: NOW1,
    publisher: undefined, // publisher is assigned by PlatformEventPublisher
    aggregateType: "Request",
    aggregateId: "req_1",
    correlationId: "corr_1",
    causationId: "cause_1",
    payload: { requestId: "req_1" },
    metadata: {},
    ...overrides,
  };
}

test("Publisher registry: creates immutable publisher contracts + rejects duplicates", () => {
  const p1 = makePublisher({ id: "request_os", allowedEventTypes: ["REQUEST_RECEIVED"] });
  const p2 = makePublisher({ id: "request_os", allowedEventTypes: ["REQUEST_UPDATED"] });

  const registry = new PlatformEventPublisherRegistry({ publishers: [p1] });
  assert.ok(Object.isFrozen(registry.getPublishers()));
  assert.deepEqual(registry.getPublisher("request_os").id, "request_os");

  assert.throws(() => {
    new PlatformEventPublisherRegistry({ publishers: [p1, p2] });
  }, /duplicate publisher id/i);
});

test("Allowed event validation: publish of disallowed eventType returns FAILED_VALIDATION", () => {
  const registry = new PlatformEventPublisherRegistry({
    publishers: [makePublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] })],
  });

  const store = new PlatformEventStore();
  const bus = new PlatformEventBus();

  const publisher = new PlatformEventPublisher({
    publisherRegistry: registry,
    publisherId: "request_os",
    store,
    bus,
    nowISO: NOW1,
  });

  const result = publisher.publish({
    eventInput: makeEventInput({ eventId: "evt_bad", eventType: "REQUEST_QUALIFIED" }),
  });

  assert.equal(result.status, PUBLISHATION_STATUSES.FAILED_VALIDATION);
  assert.equal(result.stored, false);
  assert.equal(result.dispatched, false);
  assert.ok(Array.isArray(result.errors) && result.errors.length > 0);
});

test("Successful publish: validates, stores, dispatches, returns deterministic publicationId", () => {
  let appended = 0;
  let dispatched = 0;

  const store = new PlatformEventStore();
  const bus = new PlatformEventBus({ nowISO: NOW1 });

  // Track calls without changing behavior.
  const origAppend = store.append.bind(store);
  store.append = (evt) => {
    appended += 1;
    return origAppend(evt);
  };

  const origDispatch = bus.dispatch.bind(bus);
  bus.dispatch = (evt, opts) => {
    dispatched += 1;
    return origDispatch(evt, opts);
  };

  const subscriber = createPlatformEventSubscriber({
    id: "sub_1",
    name: "sub1",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 0,
    handle: () => ({ status: "SUCCESS", message: "ok", metadata: { ok: true } }),
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber });

  const registry = new PlatformEventPublisherRegistry({ publishers: [makePublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] })] });

  const publisher = new PlatformEventPublisher({
    publisherRegistry: registry,
    publisherId: "request_os",
    store,
    bus,
    nowISO: NOW1,
  });

  const eventInput = makeEventInput({ eventId: "evt_ok_1", eventType: "REQUEST_RECEIVED", overrides: { aggregateId: "req_99" } });
  const result = publisher.publish({ eventInput });

  assert.equal(result.status, PUBLISHATION_STATUSES.PUBLISHED);
  assert.equal(result.stored, true);
  assert.equal(result.dispatched, true);
  assert.equal(appended, 1);
  assert.equal(dispatched, 1);

  assert.equal(result.publicationId, `request_os:evt_ok_1:${NOW1}`);
  assert.equal(result.eventId, "evt_ok_1");
  assert.equal(result.eventType, "REQUEST_RECEIVED");

  assert.ok(Object.isFrozen(result));
  assert.ok(result.dispatchReport);
  assert.ok(Object.isFrozen(result.dispatchReport));
  assert.ok(Object.isFrozen(result.dispatchReport.results[0]));
  assert.equal(result.dispatchReport.successCount, 1);
});

test("Dispatch failure: store succeeds but bus dispatch throws => FAILED_DISPATCH", () => {
  const store = new PlatformEventStore();
  const bus = new PlatformEventBus({ nowISO: NOW1 });

  bus.dispatch = () => {
    throw new Error("dispatch boom");
  };

  const registry = new PlatformEventPublisherRegistry({
    publishers: [makePublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] })],
  });

  const publisher = new PlatformEventPublisher({
    publisherRegistry: registry,
    publisherId: "request_os",
    store,
    bus,
    nowISO: NOW1,
  });

  const result = publisher.publish({ eventInput: makeEventInput({ eventId: "evt_dispatch_fail" }) });

  assert.equal(result.status, PUBLISHATION_STATUSES.FAILED_DISPATCH);
  assert.equal(result.stored, true);
  assert.equal(result.dispatched, false);
  assert.ok(result.errors.some((e) => String(e).includes("dispatch boom")));
});

test("Store failure: store append throws => FAILED_STORE", () => {
  const store = new PlatformEventStore();
  const bus = new PlatformEventBus({ nowISO: NOW1 });

  store.append = () => {
    throw new Error("store append boom");
  };

  const registry = new PlatformEventPublisherRegistry({
    publishers: [makePublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] })],
  });

  const publisher = new PlatformEventPublisher({
    publisherRegistry: registry,
    publisherId: "request_os",
    store,
    bus,
    nowISO: NOW1,
  });

  const result = publisher.publish({ eventInput: makeEventInput({ eventId: "evt_store_fail" }) });

  assert.equal(result.status, PUBLISHATION_STATUSES.FAILED_STORE);
  assert.equal(result.stored, false);
  assert.equal(result.dispatched, false);
  assert.ok(result.errors.some((e) => String(e).includes("store append boom")));
});

test("Publication result immutability: deep-frozen + errors frozen", () => {
  const store = new PlatformEventStore();
  const bus = new PlatformEventBus({ nowISO: NOW1 });

  const registry = new PlatformEventPublisherRegistry({
    publishers: [makePublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] })],
  });

  const publisher = new PlatformEventPublisher({
    publisherRegistry: registry,
    publisherId: "request_os",
    store,
    bus,
    nowISO: NOW1,
  });

  const result = publisher.publish({ eventInput: makeEventInput({ eventId: "evt_frozen" }) });

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.errors));
  assert.ok(Object.isFrozen(result.metadata));
});

