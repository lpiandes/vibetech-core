import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "../PlatformEventBuilder.js";
import { PlatformEventBus } from "./PlatformEventBus.js";

const NOW_A = "2026-07-01T00:00:00.000Z";
const NOW_B = "2026-07-02T00:00:00.000Z";

function makeEvent(builder, { overrides = {} } = {}) {
  return builder.build({
    eventId: overrides.eventId ?? "evt_test_1",
    eventType: overrides.eventType ?? "REQUEST_RECEIVED",
    version: overrides.version ?? 1,
    occurredAt: overrides.occurredAt ?? NOW_A,
    publisher: overrides.publisher ?? "RequestOS",
    aggregateType: overrides.aggregateType ?? "Request",
    aggregateId: overrides.aggregateId ?? "req_1",
    correlationId: overrides.correlationId ?? "corr_1",
    causationId: overrides.causationId ?? "cause_1",
    payload: overrides.payload ?? {},
    metadata: overrides.metadata ?? {},
  });
}

function makeSubscriber({ id, priority, handle } = {}) {
  return {
    id: String(id),
    name: `sub_${id}`,
    supportedEvents: ["REQUEST_RECEIVED"],
    priority: Number(priority ?? 0),
    handle,
  };
}

test("subscription/unsubscription + getSubscribersForEvent", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });
  const sub = makeSubscriber({
    id: "s1",
    priority: 1,
    handle: () => ({ status: "SUCCESS", message: "ok", metadata: {} }),
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sub });
  const subs = bus.getSubscribersForEvent("REQUEST_RECEIVED");
  assert.equal(subs.length, 1);
  assert.equal(String(subs[0].id), "s1");

  bus.unsubscribe({ eventType: "REQUEST_RECEIVED", subscriber: sub });
  assert.equal(bus.getSubscribersForEvent("REQUEST_RECEIVED").length, 0);
});

test("duplicate subscriber prevention for same eventType", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });
  const sub1 = makeSubscriber({ id: "dup", priority: 1, handle: () => ({ status: "SUCCESS", message: "ok", metadata: {} }) });
  const sub2 = makeSubscriber({ id: "dup", priority: 2, handle: () => ({ status: "SUCCESS", message: "ok2", metadata: {} }) });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sub1 });
  assert.throws(() => {
    bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sub2 });
  }, /duplicate subscriber id/i);
});

test("dispatch ordering: priority asc then subscriber id asc", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });

  const calls = [];
  const sLow = makeSubscriber({
    id: "a",
    priority: 0,
    handle: () => {
      calls.push("a");
      return { status: "SUCCESS", message: "ok", metadata: {} };
    },
  });
  const sMid = makeSubscriber({
    id: "b",
    priority: 0,
    handle: () => {
      calls.push("b");
      return { status: "SUCCESS", message: "ok", metadata: {} };
    },
  });
  const sHigh = makeSubscriber({
    id: "c",
    priority: 1,
    supportedEvents: ["REQUEST_RECEIVED"],
    handle: () => {
      calls.push("c");
      return { status: "SUCCESS", message: "ok", metadata: {} };
    },
  });

  // subscribe in any order; bus must dispatch deterministically.
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sHigh });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sMid });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sLow });

  const builder = new PlatformEventBuilder({ nowISO: NOW_A });
  const event = makeEvent(builder, { overrides: { eventId: "evt_order_1", occurredAt: NOW_A } });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW_B });
  assert.equal(report.results.length, 3);
  assert.deepEqual(calls, ["a", "b", "c"]);
});

test("subscriber success/failure/skipped + dispatch report shape + counts", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });

  const subSuccess = makeSubscriber({ id: "s_ok", priority: 0, handle: () => ({ status: "SUCCESS", message: "done", metadata: { x: 1 } }) });
  const subFailed = makeSubscriber({
    id: "s_fail",
    priority: 1,
    handle: () => {
      throw new Error("boom");
    },
  });
  const subSkipped = makeSubscriber({
    id: "s_skip",
    priority: 2,
    handle: () => undefined,
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subSuccess });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subFailed });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: subSkipped });

  const builder = new PlatformEventBuilder({ nowISO: NOW_A });
  const event = makeEvent(builder, { overrides: { eventId: "evt_dispatch_1", occurredAt: NOW_A } });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW_B });
  assert.equal(report.eventId, "evt_dispatch_1");
  assert.equal(report.eventType, "REQUEST_RECEIVED");
  assert.equal(report.dispatchedAt, NOW_B);
  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 1);
  assert.equal(report.skippedCount, 1);
  assert.equal(report.results.length, 3);

  const statuses = report.results.map((r) => r.status);
  assert.ok(statuses.includes("SUCCESS"));
  assert.ok(statuses.includes("FAILED"));
  assert.ok(statuses.includes("SKIPPED"));
});

test("validation: invalid subscriber shape + invalid result status", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });

  assert.throws(() => {
    bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: { id: "x" } });
  }, /PlatformEventSubscriber|required/i);

  const badStatusSubscriber = makeSubscriber({
    id: "s_bad_status",
    priority: 0,
    handle: () => ({ status: "NOPE", message: "no", metadata: {} }),
  });

  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: badStatusSubscriber });

  const builder = new PlatformEventBuilder({ nowISO: NOW_A });
  const event = makeEvent(builder, { overrides: { eventId: "evt_bad_status_1" } });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW_B });
  assert.equal(report.failureCount, 1);
  assert.equal(report.results[0].status, "FAILED");
});

test("immutability: dispatch report and results are deep-frozen", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_A });

  const sub = makeSubscriber({
    id: "s_frozen",
    priority: 0,
    handle: () => ({ status: "SUCCESS", message: "ok", metadata: { nested: { a: 1 } } }),
  });
  bus.subscribe({ eventType: "REQUEST_RECEIVED", subscriber: sub });

  const builder = new PlatformEventBuilder({ nowISO: NOW_A });
  const event = makeEvent(builder, { overrides: { eventId: "evt_frozen_1" } });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW_B });
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.results));
  assert.ok(Object.isFrozen(report.results[0]));
  assert.ok(Object.isFrozen(report.results[0].metadata));
});

