import assert from "node:assert/strict";
import { test } from "node:test";

import { RequestRuntime } from "./RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "./RequestEventTypes.js";

const NOW = "2026-07-01T00:00:00.000Z";

function makeEvent({ id, timestampISO, type, source = "test", payload }) {
  return { id, timestampISO, type, source, payload };
}

function baseRequestPayload(overrides = {}) {
  return {
    id: overrides.id ?? "r_1",
    title: overrides.title ?? "Customer inquiry",
    description: overrides.description ?? "A deterministic request.",
    requestType: overrides.requestType ?? "inquiry",
    priority: overrides.priority ?? "medium",
    channel: overrides.channel ?? "api",
    source: overrides.source ?? "manual",
    requester: overrides.requester ?? "owner",
    dueAt: overrides.dueAt ?? null,
    assignedWorkId: overrides.assignedWorkId ?? null,
    assignedTeamMemberId: overrides.assignedTeamMemberId ?? null,
    qualificationStatus: overrides.qualificationStatus ?? null,
    attachments: overrides.attachments ?? [],
    metadata: overrides.metadata ?? {},
  };
}

test("RequestRuntime creation: deterministic frozen seed + zero metrics", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getRequests()));
  assert.deepEqual(rt.getMetrics(), {
    totalRequests: 0,
    newRequests: 0,
    qualifiedRequests: 0,
    convertedRequests: 0,
    closedRequests: 0,
    averageAgeMs: 0,
  });
});

test("REQUEST_RECEIVED: adds request + updates request metrics", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_req_received_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r_1", channel: "email" }) },
    }),
  );

  const req = rt.getRequest("r_1");
  assert.ok(req);
  assert.ok(Object.isFrozen(req));
  assert.equal(req.status, "received");
  assert.equal(req.receivedAt, NOW);
  assert.equal(req.channel, "email");

  assert.equal(rt.getMetrics().totalRequests, 1);
  assert.equal(rt.getMetrics().newRequests, 1);
});

test("Lifecycle events: qualified/converted/closed/rejected update status + metrics", () => {
  const rt = new RequestRuntime({ nowISO: NOW });

  // r1 -> qualified
  rt.applyEvent(
    makeEvent({
      id: "evt_r1_received",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r1" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_r1_qualified",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r1", qualificationStatus: "triaged" },
    }),
  );

  // r2 -> converted
  rt.applyEvent(
    makeEvent({
      id: "evt_r2_received",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r2" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_r2_converted",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_CONVERTED,
      payload: { requestId: "r2", assignedWorkId: "work_1", assignedTeamMemberId: "tm_1" },
    }),
  );

  // r3 -> closed
  rt.applyEvent(
    makeEvent({
      id: "evt_r3_received",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r3" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_r3_closed",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_CLOSED,
      payload: { requestId: "r3" },
    }),
  );

  // r4 -> rejected
  rt.applyEvent(
    makeEvent({
      id: "evt_r4_received",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r4" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_r4_rejected",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_REJECTED,
      payload: { requestId: "r4", qualificationStatus: "missing_info" },
    }),
  );

  assert.equal(rt.getMetrics().totalRequests, 4);
  assert.equal(rt.getMetrics().newRequests, 0);
  assert.equal(rt.getMetrics().qualifiedRequests, 1);
  assert.equal(rt.getMetrics().convertedRequests, 1);
  assert.equal(rt.getMetrics().closedRequests, 1);

  assert.equal(rt.getRequest("r1").status, "qualified");
  assert.equal(rt.getRequest("r2").status, "converted");
  assert.equal(rt.getRequest("r2").assignedWorkId, "work_1");
  assert.equal(rt.getRequest("r3").status, "closed");
  assert.equal(rt.getRequest("r4").status, "rejected");
  assert.equal(rt.getRequest("r4").qualificationStatus, "missing_info");
});

test("REQUEST_UPDATED: patches allowed fields without changing id/receivedAt/status", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_r1_received",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r1" }) },
    }),
  );

  const before = rt.getRequest("r1");

  rt.applyEvent(
    makeEvent({
      id: "evt_r1_updated",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
      payload: {
        requestId: "r1",
        patch: {
          title: "Updated title",
          priority: "high",
          dueAt: "2026-07-10T00:00:00.000Z",
          attachments: ["att_1"],
          metadata: { sourceNote: "unit_test" },
        },
      },
    }),
  );

  const after = rt.getRequest("r1");
  assert.notEqual(before, after);
  assert.ok(Object.isFrozen(after));

  assert.equal(after.id, "r1");
  assert.equal(after.receivedAt, NOW);
  assert.equal(after.status, "received");
  assert.equal(after.title, "Updated title");
  assert.equal(after.priority, "high");
  assert.equal(after.dueAt, "2026-07-10T00:00:00.000Z");
  assert.deepEqual(after.attachments, ["att_1"]);
  assert.deepEqual(after.metadata, { sourceNote: "unit_test" });
});

test("Immutability: runtime state remains frozen after events", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_r1_received_immut",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r1" }) },
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_r1_qualified_immut",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r1", qualificationStatus: "ok" },
    }),
  );

  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getRequests()));
  assert.ok(Object.isFrozen(rt.getRequest("r1")));
});

test("Validation: invalid event type throws; invalid patch key throws", () => {
  const rt = new RequestRuntime({ nowISO: NOW });
  assert.throws(() => {
    rt.applyEvent(makeEvent({ id: "evt_bad_1", timestampISO: NOW, type: "NOPE", payload: {} }));
  }, /Unsupported event type/);

  rt.applyEvent(
    makeEvent({
      id: "evt_r1_received_validation",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r1" }) },
    }),
  );

  assert.throws(() => {
    rt.applyEvent(
      makeEvent({
        id: "evt_r1_bad_patch",
        timestampISO: NOW,
        type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
        payload: { requestId: "r1", patch: { status: "qualified" } },
      }),
    );
  }, /patch key not allowed/);
});

test("Metrics: averageAgeMs matches nowISO - receivedAt", () => {
  const t1 = "2026-06-21T00:00:00.000Z"; // 10 days before NOW
  const t2 = "2026-06-30T00:00:00.000Z"; // 1 day before NOW
  const rt = new RequestRuntime({ nowISO: NOW });

  rt.applyEvent(
    makeEvent({
      id: "evt_r1_received_avg",
      timestampISO: t1,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r1" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_r2_received_avg",
      timestampISO: t2,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r2" }) },
    }),
  );

  const expected = ((Date.parse(NOW) - Date.parse(t1)) + (Date.parse(NOW) - Date.parse(t2))) / 2;
  assert.equal(rt.getMetrics().averageAgeMs, expected);
});

