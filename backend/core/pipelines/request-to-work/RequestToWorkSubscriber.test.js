import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBuilder } from "../../events/PlatformEventBuilder.js";
import { PlatformEventBus } from "../../events/bus/PlatformEventBus.js";
import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";
import { validateSubscriberResultShape } from "../../events/subscribers/PlatformEventSubscriberValidator.js";

import { WorkRuntime } from "../../work/WorkRuntime.js";

import { REQUEST_TO_WORK_ACTION_TYPES } from "./RequestToWorkDefaults.js";
import { requestToWorkHandle } from "./RequestToWorkSubscriber.js";
import { mapRequestConvertedToWorkItemInput } from "./RequestToWorkMapper.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function makeConvertedEvent(overrides = {}) {
  const builder = new PlatformEventBuilder({ nowISO: NOW_ISO });
  return builder.build({
    eventId: overrides.eventId ?? "evt_req_conv_1",
    eventType: "REQUEST_CONVERTED",
    version: 1,
    occurredAt: overrides.occurredAt ?? NOW_ISO,
    publisher: "request_os",
    aggregateType: "Request",
    aggregateId: overrides.aggregateId ?? String(overrides.payload?.requestId ?? "req_1"),
    correlationId: overrides.correlationId ?? "corr_1",
    causationId: overrides.causationId ?? "cause_1",
    payload: {
      requestId: overrides.requestId ?? "req_1",
      title: overrides.title ?? "Customer inquiry",
      description: overrides.description ?? "A deterministic request.",
      requestType: overrides.requestType ?? "inquiry",
      priority: overrides.priority ?? "medium",
      channel: overrides.channel ?? "api",
      source: overrides.source ?? "manual",
      requester: overrides.requester ?? "owner",
      convertedAt: Object.prototype.hasOwnProperty.call(overrides, "convertedAt") ? overrides.convertedAt : NOW_ISO,
      assignedTeamMemberId: Object.prototype.hasOwnProperty.call(overrides, "assignedTeamMemberId") ? overrides.assignedTeamMemberId : "tm_1",
      metadata: overrides.metadata ?? { legacy: true },
      ...overrides.payload,
    },
    metadata: overrides.metadataEnvelope ?? {},
  });
}

test("subscriber creation: factory produces frozen bus-compatible subscriber", () => {
  const subscriber = createPlatformEventSubscriberFromHandler({
    id: "sub_request_to_work",
    name: "RequestToWorkSubscriber",
    operatingSystem: "request_to_work_pipeline",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    enabled: true,
    handler: requestToWorkHandle,
    handlerMetadata: { version: 1 },
  });

  assert.ok(Object.isFrozen(subscriber));
  assert.deepEqual(subscriber.supportedEvents, ["REQUEST_CONVERTED"]);
  assert.equal(subscriber.id, "sub_request_to_work");
  assert.equal(typeof subscriber.handle, "function");
});

test("REQUEST_CONVERTED handling: produces deterministic create_work_item action + mapping", () => {
  const event = makeConvertedEvent({
    requestId: "req_55",
    title: "Website inquiry",
    description: "Incoming web lead",
    requestType: "inquiry",
    priority: "high",
    channel: "website",
    source: "demo-seed",
    requester: "prospective-client",
    assignedTeamMemberId: "tm_42",
    metadata: { foo: "bar" },
  });

  const mapped = mapRequestConvertedToWorkItemInput(event.payload);
  const first = requestToWorkHandle(event, {});
  const second = requestToWorkHandle(event, {});

  assert.equal(first.status, "SUCCESS");
  assert.deepEqual(first, second);

  assert.equal(first.actions.length, 1);
  assert.equal(first.actions[0].type, REQUEST_TO_WORK_ACTION_TYPES.CREATE_WORK_ITEM);
  assert.deepEqual(first.actions[0].payload.workItemInput, mapped);

  // Spot-check key deterministic fields.
  assert.equal(mapped.id, "work_req_55");
  assert.equal(mapped.workType, "inquiry");
  assert.equal(mapped.status, "new");
  assert.equal(mapped.stageId, "stage_intake");
  assert.equal(mapped.queueId, "queue_needs_review");
  assert.equal(mapped.assignedTo, "tm_42");
  assert.equal(mapped.requestedBy, "prospective-client");
  assert.equal(mapped.createdAt, NOW_ISO);
  assert.equal(mapped.updatedAt, NOW_ISO);
  assert.deepEqual(mapped.relatedObjects, ["req_55"]);
  assert.deepEqual(mapped.metadata, { foo: "bar" });
});

test("Invalid eventType: handler returns SKIPPED (bus-compatible)", () => {
  const builder = new PlatformEventBuilder({ nowISO: NOW_ISO });
  const wrong = builder.build({
    eventId: "evt_wrong",
    eventType: "WORK_CREATED",
    version: 1,
    occurredAt: NOW_ISO,
    publisher: "work_os",
    aggregateType: "Work",
    aggregateId: "work_1",
    correlationId: "corr_1",
    causationId: "cause_1",
    payload: { workId: "work_1" },
    metadata: {},
  });

  const res = requestToWorkHandle(wrong, {});
  assert.equal(res.status, "SKIPPED");
  assert.equal(res.actions.length, 0);
});

test("Invalid payload: missing convertedAt => FAILED with errors", () => {
  const event = makeConvertedEvent({ convertedAt: null });
  const res = requestToWorkHandle(event, {});
  assert.equal(res.status, "FAILED");
  assert.ok(res.errors.length > 0);
  assert.equal(res.actions.length, 0);
});

test("Optional WorkRuntime context: applies WORK_ITEM_CREATED only when provided", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });

  const event = makeConvertedEvent({ requestId: "req_apply_1", assignedTeamMemberId: "tm_99" });
  assert.equal(workRuntime.getWorkItems().length, 0);

  // No workRuntime in context: no apply.
  const res1 = requestToWorkHandle(event, {});
  assert.equal(res1.status, "SUCCESS");
  assert.equal(workRuntime.getWorkItems().length, 0);

  // With workRuntime: should apply exactly one work item.
  const res2 = requestToWorkHandle(event, { workRuntime });
  assert.equal(res2.status, "SUCCESS");

  const items = workRuntime.getWorkItems();
  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.id, "work_req_apply_1");
  assert.equal(item.assignedTo, "tm_99");
  assert.equal(item.queueId, "queue_needs_review");
});

test("no RequestRuntime mutation: handler does not touch provided requestRuntime snapshot", () => {
  const fakeRequestRuntime = Object.freeze({ requests: [{ id: "req_1" }], metrics: { totalRequests: 1 } });
  const event = makeConvertedEvent({ requestId: "req_no_mutation" });

  const before = JSON.stringify(fakeRequestRuntime);
  const res = requestToWorkHandle(event, { requestRuntime: fakeRequestRuntime });
  const after = JSON.stringify(fakeRequestRuntime);

  assert.equal(res.status, "SUCCESS");
  assert.equal(after, before);
});

test("Subscriber result shape: factory-wrapped subscriber returns immutable SUCCESS/FAILED/SKIPPED/DISABLED", () => {
  const subscriber = createPlatformEventSubscriberFromHandler({
    id: "sub_shape",
    name: "ShapeSub",
    operatingSystem: "request_to_work_pipeline",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    enabled: true,
    handler: requestToWorkHandle,
  });

  const event = makeConvertedEvent({ requestId: "req_shape" });
  const handled = subscriber.handle(event);
  assert.ok(Object.isFrozen(handled));
  assert.deepEqual(validateSubscriberResultShape(handled), true);
});

test("Bus compatibility: subscriber can be subscribed and dispatched deterministically", () => {
  const bus = new PlatformEventBus({ nowISO: NOW_ISO });
  const subscriber = createPlatformEventSubscriberFromHandler({
    id: "sub_bus",
    name: "BusSub",
    operatingSystem: "request_to_work_pipeline",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    enabled: true,
    handler: requestToWorkHandle,
  });

  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber });
  const event = makeConvertedEvent({ requestId: "req_bus_1" });

  const report = bus.dispatch(event, { dispatchedAtISO: NOW_ISO });
  assert.equal(report.eventId, event.eventId);
  assert.equal(report.eventType, "REQUEST_CONVERTED");
  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 0);
});

