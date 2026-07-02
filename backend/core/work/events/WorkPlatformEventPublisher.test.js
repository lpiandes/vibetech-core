import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { WorkRuntime } from "../WorkRuntime.js";

import { WORK_EVENT_TYPES } from "../WorkEventTypes.js";

import { PlatformEventPublisherRegistry } from "../../events/publishing/PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "../../events/publishing/PlatformEventPublisher.js";
import { PlatformEventStore } from "../../events/PlatformEventStore.js";
import { PlatformEventBus } from "../../events/bus/PlatformEventBus.js";

import { mapWorkItemCreatedToPlatformEventInput } from "./WorkPlatformEventMapper.js";
import { WorkPlatformEventPublisher } from "./WorkPlatformEventPublisher.js";
import { WORK_OS_PUBLISHER_ID } from "./WorkPlatformEventDefaults.js";

const NOW = "2026-07-01T00:00:00.000Z";
const WORK_CREATED_AT = "2026-07-02T00:00:00.000Z";

function makeWorkItemCreatedEvent({ workItemId = "work_1" } = {}) {
  const payloadWorkItem = {
    id: workItemId,
    title: "Onboard request",
    description: "Needs paperwork review.",
    workType: "onboarding",
    status: "new",
    priority: "medium",
    stageId: "stage_intake",
    queueId: "queue_needs_review",
    assignedTo: "assignee_1",
    requestedBy: "requester_1",
    source: "demo-seed",
    dueAt: null,
    createdAt: WORK_CREATED_AT,
    updatedAt: WORK_CREATED_AT,
    completedAt: null,
    blockedReason: null,
    relatedObjects: [{ kind: "request", id: "req_1" }],
    requirements: ["doc_pack"],
    metadata: { legacy: true },
  };

  return {
    id: `evt_${WORK_EVENT_TYPES.WORK_ITEM_CREATED.toLowerCase()}_${workItemId}`,
    timestampISO: WORK_CREATED_AT,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem: payloadWorkItem },
  };
}

function buildPlatformPublisher({ nowISO = NOW, allowedEventTypes = ["WORK_CREATED"] } = {}) {
  const publisherRegistry = new PlatformEventPublisherRegistry({
    publishers: [
      {
        id: WORK_OS_PUBLISHER_ID,
        name: "Work OS",
        operatingSystem: "work_os",
        allowedEventTypes,
        version: 1,
        metadata: {},
      },
    ],
  });

  const store = new PlatformEventStore({ nowISO });
  const bus = new PlatformEventBus({ nowISO });

  const publisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: WORK_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO,
  });

  return { publisherRegistry, store, bus, publisher };
}

test("WORK_ITEM_CREATED maps deterministically to canonical WORK_CREATED PlatformEvent input", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const workItemCreatedEvent = makeWorkItemCreatedEvent({ workItemId: "work_123" });

  workRuntime.applyEvent(workItemCreatedEvent);

  const createdWorkItem = workRuntime.getWorkItem("work_123");
  assert.ok(createdWorkItem);

  const input = mapWorkItemCreatedToPlatformEventInput({
    workRuntime,
    workCreatedEvent: workItemCreatedEvent,
    createdWorkItem,
    createdAtISO: WORK_CREATED_AT,
  });

  assert.equal(input.eventType, "WORK_CREATED");
  assert.equal(input.aggregateType, "work");
  assert.equal(input.aggregateId, "work_123");
  assert.equal(input.occurredAt, WORK_CREATED_AT);
  assert.equal(input.payload.workItemId, "work_123");
  assert.equal(input.payload.title, "Onboard request");
  assert.equal(input.payload.description, "Needs paperwork review.");
  assert.equal(input.payload.workType, "onboarding");
  assert.equal(input.payload.status, "new");
  assert.equal(input.payload.priority, "medium");
  assert.equal(input.payload.stageId, "stage_intake");
  assert.equal(input.payload.queueId, "queue_needs_review");
  assert.equal(input.payload.assignedTo, "assignee_1");
  assert.equal(input.payload.requestedBy, "requester_1");
  assert.equal(input.payload.source, "demo-seed");
  assert.equal(input.payload.createdAt, WORK_CREATED_AT);
  assert.deepEqual(input.payload.relatedObjects, [{ kind: "request", id: "req_1" }]);
  assert.deepEqual(input.payload.metadata, { legacy: true });
  assert.ok(String(input.eventId).includes("evt_work_created_work_123"));
});

test("Allowed event validation: disallowed WORK_CREATED returns FAILED_VALIDATION", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  workRuntime.applyEvent(makeWorkItemCreatedEvent({ workItemId: "work_1" }));

  const { publisher, store, bus } = buildPlatformPublisher({ allowedEventTypes: ["WORK_ITEM_CREATED"] });
  const osPublisher = new WorkPlatformEventPublisher({ platformEventPublisher: publisher });

  const result = osPublisher.publishWorkCreated({
    workRuntime,
    workCreatedEvent: makeWorkItemCreatedEvent({ workItemId: "work_1" }),
    createdWorkItem: workRuntime.getWorkItem("work_1"),
    createdAtISO: WORK_CREATED_AT,
  });

  assert.equal(result.status, "FAILED_VALIDATION");
  assert.equal(result.stored, false);
  assert.equal(result.dispatched, false);
  assert.equal(store.getEvents().length, 0);
  assert.equal(bus.getSubscriptions().length, 0);
});

test("Successful publish: event stored in PlatformEventStore + dispatched through PlatformEventBus", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const workItemCreatedEvent = makeWorkItemCreatedEvent({ workItemId: "work_9" });
  workRuntime.applyEvent(workItemCreatedEvent);

  const { publisher, store, bus } = buildPlatformPublisher();

  const subscriber = {
    id: "sub_1",
    name: "CaptureWorkCreated",
    supportedEvents: ["WORK_CREATED"],
    priority: 0,
    handle: () => ({ status: "SUCCESS", message: "ok", metadata: { received: true } }),
  };
  bus.subscribe({ eventType: "WORK_CREATED", subscriber });

  const osPublisher = new WorkPlatformEventPublisher({ platformEventPublisher: publisher });
  const result = osPublisher.publishWorkCreated({
    workRuntime,
    workCreatedEvent: workItemCreatedEvent,
    createdWorkItem: workRuntime.getWorkItem("work_9"),
    createdAtISO: WORK_CREATED_AT,
  });

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.stored, true);
  assert.equal(result.dispatched, true);
  assert.ok(result.dispatchReport);

  const stored = store.getEvent(result.eventId);
  assert.ok(stored);
  assert.equal(stored.eventType, "WORK_CREATED");

  assert.equal(result.dispatchReport.successCount, 1);
  assert.equal(result.dispatchReport.results[0].status, "SUCCESS");
});

test("WorkRuntime remains usable without publisher + does not import event platform", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  workRuntime.applyEvent(makeWorkItemCreatedEvent({ workItemId: "work_1" }));
  assert.ok(workRuntime.getWorkItem("work_1"));

  const contents = readFileSync(join(process.cwd(), "backend/core/work/WorkRuntime.js"), "utf8");
  assert.equal(contents.includes("PlatformEventPublisher"), false);
  assert.equal(contents.includes("backend/core/events"), false);
  assert.equal(contents.includes("/events/"), false);
});

test("Optional compatibility: bus subscriber receives WORK_CREATED", () => {
  const workRuntime = new WorkRuntime({ nowISO: NOW });
  const workItemCreatedEvent = makeWorkItemCreatedEvent({ workItemId: "work_77" });
  workRuntime.applyEvent(workItemCreatedEvent);

  const { publisher, store, bus } = buildPlatformPublisher();

  const subscriber = {
    id: "sub_capture",
    name: "Capture",
    supportedEvents: ["WORK_CREATED"],
    priority: 0,
    handle: (event) => ({
      status: "SUCCESS",
      message: "captured",
      metadata: { workItemId: event.payload.workItemId },
    }),
  };
  bus.subscribe({ eventType: "WORK_CREATED", subscriber });

  const osPublisher = new WorkPlatformEventPublisher({ platformEventPublisher: publisher });
  const result = osPublisher.publishWorkCreated({
    workRuntime,
    workCreatedEvent: workItemCreatedEvent,
    createdWorkItem: workRuntime.getWorkItem("work_77"),
    createdAtISO: WORK_CREATED_AT,
  });

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.dispatchReport.successCount, 1);
  assert.equal(result.dispatchReport.results[0].metadata.workItemId, "work_77");
  assert.equal(store.getEventsByType("WORK_CREATED").length, 1);
});

