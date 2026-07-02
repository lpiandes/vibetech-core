import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "../PlatformEventBuilder.js";
import { PlatformEventBus } from "../bus/PlatformEventBus.js";

import { PlatformEventSubscriberRegistry } from "./PlatformEventSubscriberRegistry.js";
import { createPlatformEventSubscriberFromHandler } from "./PlatformEventSubscriberFactory.js";
import { createPlatformEventSubscriberResult } from "./PlatformEventSubscriberResult.js";
import { validateSubscriberResultShape } from "./PlatformEventSubscriberValidator.js";

const NOW = "2026-07-01T00:00:00.000Z";

function makeEvent(builder, { eventId = "evt_1", eventType = "REQUEST_RECEIVED", occurredAt = NOW } = {}) {
  return builder.build({
    eventId,
    eventType,
    version: 1,
    occurredAt,
    publisher: "RequestOS",
    aggregateType: "Request",
    aggregateId: "req_1",
    correlationId: "corr_1",
    causationId: "cause_1",
    payload: { requestId: "req_1" },
    metadata: {},
  });
}

test("subscriber creation: factory creates frozen bus-compatible subscriber", () => {
  const sub = createPlatformEventSubscriberFromHandler({
    id: "sub_1",
    name: "S1",
    operatingSystem: "RequestOS",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 1,
    enabled: true,
    handler: () => ({ status: "SUCCESS", message: "ok", actions: ["a1"], errors: [], metadata: {} }),
  });

  assert.ok(Object.isFrozen(sub));
  assert.ok(Object.isFrozen(sub.supportedEvents));
  assert.equal(sub.id, "sub_1");
  assert.equal(sub.priority, 1);
});

test("subscriber result validation: immutable result + allowed statuses", () => {
  const r = createPlatformEventSubscriberResult({
    subscriberId: "sub_1",
    subscriberName: "S1",
    eventId: "evt_1",
    eventType: "REQUEST_RECEIVED",
    status: "DISABLED",
    message: "",
    actions: [],
    errors: [],
    metadata: {},
  });

  assert.ok(Object.isFrozen(r));
  assert.deepEqual(validateSubscriberResultShape(r), true);
});

test("registry behavior: register/unregister + enabled filtering", () => {
  const registry = new PlatformEventSubscriberRegistry({
    subscribers: [
      createPlatformEventSubscriberFromHandler({
        id: "s_enabled",
        name: "Enabled",
        operatingSystem: "RequestOS",
        supportedEvents: ["REQUEST_RECEIVED"],
        priority: 0,
        enabled: true,
        handler: () => ({ status: "SUCCESS", message: "ok", actions: [], errors: [], metadata: {} }),
      }),
      createPlatformEventSubscriberFromHandler({
        id: "s_disabled",
        name: "Disabled",
        operatingSystem: "RequestOS",
        supportedEvents: ["REQUEST_RECEIVED"],
        priority: 0,
        enabled: false,
        handler: () => {
          throw new Error("should not run");
        },
      }),
    ],
  });

  assert.equal(registry.getSubscribers().length, 2);
  assert.equal(registry.getSubscribersByEvent("REQUEST_RECEIVED").length, 2);
  assert.equal(registry.getEnabledSubscribersByEvent("REQUEST_RECEIVED").length, 1);

  registry.unregister("s_disabled");
  assert.equal(registry.getSubscribers().length, 1);
});

test("bus compatibility: disabled subscriber returns DISABLED result and bus dispatch validates it", () => {
  const bus = new PlatformEventBus({ nowISO: NOW });
  const builder = new PlatformEventBuilder({ nowISO: NOW });
  const event = makeEvent(builder, { eventId: "evt_bus_1" });

  const disabledSub = createPlatformEventSubscriberFromHandler({
    id: "sub_disabled",
    name: "DisabledSub",
    operatingSystem: "RequestOS",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 0,
    enabled: false,
    handler: () => ({ status: "SUCCESS", message: "should_not_run", actions: [], errors: [], metadata: {} }),
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: disabledSub });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW });
  assert.equal(report.results[0].status, "DISABLED");
});

test("bus dispatch: subscriber success failure skipped are mapped into deterministic report counts", () => {
  const bus = new PlatformEventBus({ nowISO: NOW });
  const builder = new PlatformEventBuilder({ nowISO: NOW });
  const event = makeEvent(builder, { eventId: "evt_bus_2" });

  const subSuccess = createPlatformEventSubscriberFromHandler({
    id: "sub_ok",
    name: "OK",
    operatingSystem: "RequestOS",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 0,
    enabled: true,
    handler: () => ({ status: "SUCCESS", message: "ok", actions: [], errors: [], metadata: {} }),
  });

  const subFailed = createPlatformEventSubscriberFromHandler({
    id: "sub_fail",
    name: "FAIL",
    operatingSystem: "RequestOS",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 1,
    enabled: true,
    handler: () => {
      throw new Error("boom");
    },
  });

  const subSkipped = createPlatformEventSubscriberFromHandler({
    id: "sub_skip",
    name: "SKIP",
    operatingSystem: "RequestOS",
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: 2,
    enabled: true,
    handler: () => undefined,
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subSuccess });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subFailed });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subSkipped });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW });
  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 1);
  // SKIPPED/undefined handlers are treated as SKIPPED by the bus.
  assert.equal(report.skippedCount, 1);
});

