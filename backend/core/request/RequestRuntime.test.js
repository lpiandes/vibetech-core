import assert from "node:assert/strict";
import { test } from "node:test";

import { RequestRuntime } from "./RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "./RequestEventTypes.js";

const NOW = "2026-07-01T00:00:00.000Z";
const PAST = "2026-06-30T00:00:00.000Z";

function makeEvent({ id, timestampISO, type, source, payload }) {
  return { id, timestampISO, type, source, payload };
}

function baseRequest({ overrides } = {}) {
  return {
    id: overrides?.id ?? "req_1",
    title: overrides?.title ?? "Prospective client inquiry",
    description: overrides?.description ?? "A deterministic request payload.",
    requestType: overrides?.requestType ?? "generic",
    status: overrides?.status ?? "received",
    priority: overrides?.priority ?? "medium",
    channel: overrides?.channel ?? "website",
    source: overrides?.source ?? "manual",
    requester: overrides?.requester ?? "owner",
    receivedAt: overrides?.receivedAt ?? NOW,
    dueAt: overrides?.dueAt ?? null,
    assignedWorkId: overrides?.assignedWorkId ?? null,
    assignedTeamMemberId: overrides?.assignedTeamMemberId ?? null,
    qualificationStatus: overrides?.qualificationStatus ?? null,
    attachments: Array.isArray(overrides?.attachments) ? overrides.attachments : [],
    metadata: overrides?.metadata ?? {},
  };
}

test("RequestRuntime: initializes deterministic frozen seed + metrics", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  assert.ok(Object.isFrozen(rt._state));
  assert.deepEqual(rt.getRequests(), []);
  assert.equal(rt.getMetrics().totalRequests, 0);
  assert.equal(rt.getMetrics().newRequests, 0);
  assert.equal(rt.getMetrics().qualifiedRequests, 0);
  assert.equal(rt.getMetrics().convertedRequests, 0);
  assert.equal(rt.getMetrics().closedRequests, 0);
  assert.equal(rt.getMetrics().averageAgeDays, 0);
});

test("REQUEST_RECEIVED: adds request + updates newRequests metric", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_1", receivedAt: NOW } }) },
    }),
  );

  const req = rt.getRequests().find((r) => r.id === "req_1");
  assert.ok(req);
  assert.equal(req.status, "received");
  assert.equal(rt.getMetrics().totalRequests, 1);
  assert.equal(rt.getMetrics().newRequests, 1);
});

test("REQUEST_UPDATED: updates fields but does not change status/identity", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_2",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_2" } }) },
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_req_updated_2",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
      source: "unit_test",
      payload: { requestId: "req_2", patch: { title: "Updated title", description: "Updated description" } },
    }),
  );

  const req = rt.getRequests().find((r) => r.id === "req_2");
  assert.ok(req);
  assert.equal(req.title, "Updated title");
  assert.equal(req.description, "Updated description");
  assert.equal(req.status, "received");
});

test("Qualification/Conversion/Closure transitions: metrics move deterministically", () => {
  const rt = new RequestRuntime({ nowISO: NOW });

  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_3",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_3" } }) },
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_req_qualified_3",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      source: "unit_test",
      payload: { requestId: "req_3", qualificationStatus: "meets_criteria" },
    }),
  );

  let req = rt.getRequests().find((r) => r.id === "req_3");
  assert.equal(req.status, "qualified");
  assert.equal(req.qualificationStatus, "meets_criteria");
  assert.equal(rt.getMetrics().qualifiedRequests, 1);

  rt.applyEvent(
    makeEvent({
      id: "evt_req_converted_3",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
      source: "unit_test",
      payload: { requestId: "req_3", assignedWorkId: "work_1", assignedTeamMemberId: "tm_1" },
    }),
  );

  req = rt.getRequests().find((r) => r.id === "req_3");
  assert.equal(req.status, "converted");
  assert.equal(req.assignedWorkId, "work_1");
  assert.equal(rt.getMetrics().convertedRequests, 1);

  rt.applyEvent(
    makeEvent({
      id: "evt_req_closed_3",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_CLOSED,
      source: "unit_test",
      payload: { requestId: "req_3" },
    }),
  );

  req = rt.getRequests().find((r) => r.id === "req_3");
  assert.equal(req.status, "closed");
  assert.equal(rt.getMetrics().closedRequests, 1);
});

test("Metrics: averageAgeDays uses runtime nowISO deterministically", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_4",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_4", receivedAt: PAST } }) },
    }),
  );

  assert.equal(rt.getMetrics().averageAgeDays, 1);
});

test("Immutability: runtime + nested request/metadata/attachments are frozen", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_5",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: {
        request: baseRequest({
          overrides: {
            id: "req_5",
            metadata: { foo: { bar: "baz" } },
            attachments: [{ id: "att_1", name: "file.pdf" }],
          },
        }),
      },
    }),
  );

  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getRequests()));
  const req = rt.getRequests()[0];
  assert.ok(Object.isFrozen(req));
  assert.ok(Object.isFrozen(req.metadata));
  assert.ok(Object.isFrozen(req.attachments));
  assert.ok(Object.isFrozen(req.attachments[0]));
});

test("Determinism: same seed + same events => same frozen runtime state", () => {
  const rtA = new RequestRuntime({ nowISO: NOW });
  const rtB = new RequestRuntime({ nowISO: NOW });

  const events = [
    makeEvent({
      id: "evt_req_received_det_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_det_1" } }) },
    }),
    makeEvent({
      id: "evt_req_qualified_det_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      source: "unit_test",
      payload: { requestId: "req_det_1", qualificationStatus: "ok" },
    }),
    makeEvent({
      id: "evt_req_converted_det_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
      source: "unit_test",
      payload: { requestId: "req_det_1", assignedWorkId: "work_det_1" },
    }),
  ];

  for (const e of events) {
    rtA.applyEvent(e);
    rtB.applyEvent(e);
  }

  assert.deepEqual(rtA._state, rtB._state);
});

test("Validation: REQUEST_UPDATED rejects attempts to patch identity/status/receivedAt", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_val_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      source: "unit_test",
      payload: { request: baseRequest({ overrides: { id: "req_val_1" } }) },
    }),
  );

  assert.throws(() => {
    rt.applyEvent(
      makeEvent({
        id: "evt_req_updated_val_1",
        timestampISO: NOW,
        type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
        source: "unit_test",
        payload: { requestId: "req_val_1", patch: { status: "qualified" } },
      }),
    );
  });

  assert.throws(() => {
    rt.applyEvent(
      makeEvent({
        id: "evt_req_updated_val_2",
        timestampISO: NOW,
        type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
        source: "unit_test",
        payload: { requestId: "req_val_1", patch: { receivedAt: PAST } },
      }),
    );
  });
});

