import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "../../events/PlatformEventBuilder.js";

import { AnalyticsRuntime } from "../AnalyticsRuntime.js";

import { createAnalyticsEventSubscriber } from "./AnalyticsEventSubscriber.js";
import { AnalyticsSubscriberRegistry } from "./AnalyticsSubscriberRegistry.js";

import { validateSubscriberResultShape } from "../../events/subscribers/PlatformEventSubscriberValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:10:00.000Z";

function getDim(dimensions, dimensionId) {
  const d = dimensions.find((x) => String(x.dimensionId) === String(dimensionId));
  return d?.value;
}

function makeBaseEvent({ eventId = "evt_1", eventType, payload = {}, metadata = {}, occurredAt = NOW0 } = {}) {
  const builder = new PlatformEventBuilder({ nowISO: NOW0 });
  return builder.build({
    eventId,
    eventType,
    version: 1,
    occurredAt,
    publisher: "unit_test_publisher",
    aggregateType: "UnitTest",
    aggregateId: "agg_1",
    correlationId: "corr_1",
    causationId: "cause_1",
    payload,
    metadata,
  });
}

test("AnalyticsEventSubscriber: supported event mappings create analytics datapoints (value=1)", () => {
  const analyticsRuntime = new AnalyticsRuntime({ nowISO: NOW0 });

  const subscriber = createAnalyticsEventSubscriber({
    id: "sub_analytics_events_1",
    name: "AnalyticsEventSubscriber1",
    analyticsRuntime,
    priority: 0,
    enabled: true,
    operatingSystem: "analytics_os",
  });

  const reqEvt = makeBaseEvent({
    eventId: "evt_req_received_1",
    eventType: "REQUEST_RECEIVED",
    occurredAt: NOW0,
    payload: {
      request: {
        requestType: "inquiry",
        priority: "high",
        channel: "website",
        requester: "prospective-client",
      },
    },
    metadata: { companyId: "co_1", industry: "manufacturing" },
  });

  const res = subscriber.handle(reqEvt);
  assert.equal(res.status, "SUCCESS");
  validateSubscriberResultShape(res);

  const dps = analyticsRuntime.getDataPoints();
  assert.equal(dps.length, 1);
  const dp = dps[0];
  assert.equal(dp.metricId, "request_received_count");
  assert.equal(dp.value, 1);

  // Dimensions
  assert.equal(getDim(dp.dimensions, "companyId"), "co_1");
  assert.equal(getDim(dp.dimensions, "industry"), "manufacturing");
  assert.equal(getDim(dp.dimensions, "requestType"), "inquiry");
  assert.equal(getDim(dp.dimensions, "priority"), "high");
  assert.equal(getDim(dp.dimensions, "channel"), "website");
});

test("AnalyticsEventSubscriber: WORK_ASSIGNED mapping uses assignment dimensions", () => {
  const analyticsRuntime = new AnalyticsRuntime({ nowISO: NOW0 });
  const subscriber = createAnalyticsEventSubscriber({ id: "sub_a2", name: "A2", analyticsRuntime });

  const evt = makeBaseEvent({
    eventId: "evt_work_assigned_1",
    eventType: "WORK_ASSIGNED",
    occurredAt: NOW1,
    payload: {
      assignment: { assigneeId: "tm_42", assigneeType: "human" },
    },
    metadata: { companyId: "co_2", industry: "law_firm" },
  });

  const res = subscriber.handle(evt);
  assert.equal(res.status, "SUCCESS");

  const dp = analyticsRuntime.getDataPoints()[0];
  assert.equal(dp.metricId, "work_assigned_count");
  assert.equal(getDim(dp.dimensions, "employeeId"), "tm_42");
});

test("AnalyticsEventSubscriber: unknown event skipped (no datapoint recorded)", () => {
  const analyticsRuntime = new AnalyticsRuntime({ nowISO: NOW0 });
  const subscriber = createAnalyticsEventSubscriber({ id: "sub_unknown", name: "Unknown", analyticsRuntime });

  const evt = makeBaseEvent({
    eventId: "evt_unknown_1",
    eventType: "UNKNOWN_EVENT_TYPE",
    payload: {},
    metadata: { companyId: "co_9" },
  });

  const res = subscriber.handle(evt);
  assert.equal(res.status, "SKIPPED");
  validateSubscriberResultShape(res);
  assert.equal(analyticsRuntime.getDataPoints().length, 0);
});

test("AnalyticsEventSubscriber: runtime updated only via applyEvent + immutability of subscriber result", () => {
  const analyticsRuntime = new AnalyticsRuntime({ nowISO: NOW0 });
  const calls = [];
  const original = analyticsRuntime.applyEvent.bind(analyticsRuntime);
  analyticsRuntime.applyEvent = (evt) => {
    calls.push(evt);
    return original(evt);
  };

  const subscriber = createAnalyticsEventSubscriber({ id: "sub_mutation_1", name: "M1", analyticsRuntime });

  const evt = makeBaseEvent({
    eventId: "evt_comm_failed_1",
    eventType: "COMMUNICATION_FAILED",
    occurredAt: NOW1,
    payload: { channel: "email", reason: "bounce", communicationId: "comm_1" },
    metadata: { companyId: "co_3" },
  });

  const res = subscriber.handle(evt);
  assert.equal(res.status, "SUCCESS");
  validateSubscriberResultShape(res);
  assert.ok(calls.length >= 1);

  // Subscriber result should be frozen.
  assert.ok(Object.isFrozen(res));
});

test("AnalyticsSubscriberRegistry: register/unregister/get/subscribersForEvent", () => {
  const analyticsRuntime = new AnalyticsRuntime({ nowISO: NOW0 });
  const subscriber = createAnalyticsEventSubscriber({
    id: "sub_reg_1",
    name: "Reg1",
    analyticsRuntime,
  });

  const registry = new AnalyticsSubscriberRegistry({ subscribers: [subscriber] });
  assert.equal(registry.getSubscribers().length, 1);
  assert.equal(registry.getSubscriber("sub_reg_1").id, "sub_reg_1");

  const before = registry.getSubscribersForEvent("REQUEST_RECEIVED").length;
  assert.ok(before >= 1);

  registry.unregister("sub_reg_1");
  assert.equal(registry.getSubscribers().length, 0);
  assert.equal(registry.getSubscriber("sub_reg_1"), null);
});

