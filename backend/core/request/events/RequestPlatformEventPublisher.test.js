import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RequestRuntime } from "../RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../RequestEventTypes.js";

import { PlatformEventPublisherRegistry } from "../../events/publishing/PlatformEventPublisherRegistry.js";
import { PlatformEventPublisher } from "../../events/publishing/PlatformEventPublisher.js";
import { PlatformEventStore } from "../../events/PlatformEventStore.js";
import { PlatformEventBus } from "../../events/bus/PlatformEventBus.js";

import { mapRequestConvertedToPlatformEventInput } from "./RequestPlatformEventMapper.js";
import { RequestPlatformEventPublisher } from "./RequestPlatformEventPublisher.js";
import { REQUEST_OS_PUBLISHER_ID } from "./RequestPlatformEventDefaults.js";
// eslint-disable-next-line no-unused-vars
import { validateRequestConvertedRequestToPlatformEvent } from "./RequestPlatformEventValidator.js";

import { requestToWorkHandle } from "../../pipelines/request-to-work/RequestToWorkSubscriber.js";

const NOW = "2026-07-01T00:00:00.000Z";
const CONVERTED_AT = "2026-07-02T00:00:00.000Z";

function makeRequestReceivedEvent({ nowISO } = {}) {
  const payload = {
    id: "req_1",
    title: "Customer inquiry",
    description: "A deterministic request.",
    requestType: "inquiry",
    status: "received",
    priority: "medium",
    channel: "website",
    source: "demo-seed",
    requester: "prospective-client",
    dueAt: null,
    assignedWorkId: null,
    assignedTeamMemberId: null,
    qualificationStatus: null,
    attachments: [],
    metadata: { legacy: true },
  };

  return {
    id: "evt_req_received_1",
    timestampISO: String(nowISO ?? NOW),
    type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
    source: "test",
    payload: { request: payload },
  };
}

function makeRequestConvertedEvent({ assignedWorkId = "work_1", assignedTeamMemberId = "tm_1" } = {}) {
  return {
    id: "evt_req_converted_1",
    timestampISO: CONVERTED_AT,
    type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
    source: "test",
    payload: {
      requestId: "req_1",
      assignedWorkId,
      assignedTeamMemberId,
      qualificationStatus: "triaged",
    },
  };
}

function buildPlatformPublisher({ nowISO = NOW, allowedEventTypes = ["REQUEST_CONVERTED"] } = {}) {
  const publisherRegistry = new PlatformEventPublisherRegistry({
    publishers: [
      {
        id: REQUEST_OS_PUBLISHER_ID,
        name: "Request OS",
        operatingSystem: "request_os",
        allowedEventTypes,
        version: 1,
        metadata: {},
      },
    ],
  });

  const store = new PlatformEventStore();
  const bus = new PlatformEventBus({ nowISO });

  const publisher = new PlatformEventPublisher({
    publisherRegistry,
    publisherId: REQUEST_OS_PUBLISHER_ID,
    store,
    bus,
    nowISO,
  });

  return { publisherRegistry, store, bus, publisher };
}

test("REQUEST_CONVERTED maps deterministically to canonical PlatformEvent input", () => {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  const receivedEvent = makeRequestReceivedEvent();
  requestRuntime.applyEvent(receivedEvent);

  const convertedEvent = makeRequestConvertedEvent({ assignedWorkId: "work_1", assignedTeamMemberId: "tm_42" });
  requestRuntime.applyEvent(convertedEvent);

  const req = requestRuntime.getRequest("req_1");
  assert.ok(req);

  const input = mapRequestConvertedToPlatformEventInput({
    requestRuntime,
    requestConvertedEvent: convertedEvent,
    convertedAtISO: CONVERTED_AT,
    convertedRequest: req,
  });

  assert.equal(input.eventType, "REQUEST_CONVERTED");
  assert.equal(input.aggregateType, "request");
  assert.equal(input.aggregateId, "req_1");
  assert.equal(input.occurredAt, CONVERTED_AT);
  assert.equal(input.payload.requestId, "req_1");
  assert.equal(input.payload.convertedAt, CONVERTED_AT);
  assert.equal(input.payload.assignedWorkId, "work_1");
  assert.equal(input.payload.assignedTeamMemberId, "tm_42");
  assert.deepEqual(input.payload.metadata, { legacy: true });
  assert.ok(String(input.eventId).includes("evt_request_converted_req_1"));
});

test("Allowed event validation: disallowed REQUEST_CONVERTED returns FAILED_VALIDATION", () => {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  requestRuntime.applyEvent(makeRequestReceivedEvent());

  const convertedEvent = makeRequestConvertedEvent();
  requestRuntime.applyEvent(convertedEvent);

  const { publisher, store, bus } = buildPlatformPublisher({ allowedEventTypes: ["REQUEST_RECEIVED"] });
  const osPublisher = new RequestPlatformEventPublisher({ platformEventPublisher: publisher });

  const result = osPublisher.publishRequestConverted({
    requestRuntime,
    requestConvertedEvent: convertedEvent,
    convertedAtISO: CONVERTED_AT,
  });

  assert.equal(result.status, "FAILED_VALIDATION");
  assert.equal(result.stored, false);
  assert.equal(result.dispatched, false);
  assert.equal(store.getEvents().length, 0);
  assert.equal(bus.getSubscriptions().length, 0);
});

test("Successful publish: event stored in PlatformEventStore + dispatched through PlatformEventBus", () => {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  requestRuntime.applyEvent(makeRequestReceivedEvent());
  const convertedEvent = makeRequestConvertedEvent({ assignedWorkId: "work_9", assignedTeamMemberId: "tm_9" });
  requestRuntime.applyEvent(convertedEvent);

  const { publisher, store, bus } = buildPlatformPublisher();

  // Add a deterministic bus subscriber to prove dispatch occurs.
  const subscriber = {
    id: "sub_1",
    name: "CaptureSub",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    handle: () => ({ status: "SUCCESS", message: "ok", metadata: { received: true } }),
  };
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber });

  const requestOSPublisher = new RequestPlatformEventPublisher({ platformEventPublisher: publisher });
  const result = requestOSPublisher.publishRequestConverted({
    requestRuntime,
    requestConvertedEvent: convertedEvent,
    convertedAtISO: CONVERTED_AT,
  });

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.stored, true);
  assert.equal(result.dispatched, true);
  assert.ok(result.dispatchReport);

  const stored = store.getEvent(result.eventId);
  assert.ok(stored);
  assert.equal(stored.eventType, "REQUEST_CONVERTED");

  assert.equal(result.dispatchReport.successCount, 1);
  assert.equal(result.dispatchReport.results[0].status, "SUCCESS");
});

test("RequestRuntime remains usable without publisher + does not import event platform", () => {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  requestRuntime.applyEvent(makeRequestReceivedEvent());
  const convertedEvent = makeRequestConvertedEvent();
  requestRuntime.applyEvent(convertedEvent);
  assert.equal(requestRuntime.getRequest("req_1").status, "converted");

  const contents = readFileSync(join(process.cwd(), "backend/core/request/RequestRuntime.js"), "utf8");
  assert.equal(contents.includes("PlatformEventPublisher"), false);
  assert.equal(contents.includes("backend/core/events"), false);
  assert.equal(contents.includes("/events/"), false);
});

test("Optional compatibility: RequestToWorkSubscriber receives published REQUEST_CONVERTED via bus", () => {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  requestRuntime.applyEvent(makeRequestReceivedEvent());
  const convertedEvent = makeRequestConvertedEvent({ assignedTeamMemberId: "tm_77" });
  requestRuntime.applyEvent(convertedEvent);

  const { publisher, store, bus } = buildPlatformPublisher();

  // Bus subscriber wrapper that exposes RequestToWorkSubscriber actions via dispatchResult.metadata.actions.
  const subscriber = {
    id: "sub_req_to_work",
    name: "ReqToWork",
    supportedEvents: ["REQUEST_CONVERTED"],
    priority: 0,
    handle: (event) => {
      const res = requestToWorkHandle(event, {});
      return {
        status: res.status,
        message: res.message,
        metadata: { actions: res.actions, errors: res.errors },
      };
    },
  };
  bus.subscribe({ eventType: "REQUEST_CONVERTED", subscriber });

  const osPublisher = new RequestPlatformEventPublisher({ platformEventPublisher: publisher });
  const result = osPublisher.publishRequestConverted({
    requestRuntime,
    requestConvertedEvent: convertedEvent,
    convertedAtISO: CONVERTED_AT,
  });

  assert.equal(result.status, "PUBLISHED");
  assert.equal(result.dispatchReport.successCount, 1);

  const actions = result.dispatchReport.results[0].metadata.actions;
  assert.ok(Array.isArray(actions) && actions.length === 1);
  assert.equal(actions[0].type, "create_work_item");
});

