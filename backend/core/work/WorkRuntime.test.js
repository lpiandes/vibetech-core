import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "./WorkRuntime.js";
import { WORK_EVENT_TYPES } from "./WorkEventTypes.js";

const NOW = "2026-07-01T00:00:00.000Z";

function baseWorkPayload(overrides = {}) {
  return {
    workItem: {
      id: overrides.id ?? "wi_1",
      title: overrides.title ?? "Customer inquiry",
      description: overrides.description ?? "A deterministic work item.",
      workType: overrides.workType ?? "inquiry",
      status: overrides.status ?? "new",
      priority: overrides.priority ?? "medium",
      stageId: overrides.stageId ?? "stage_intake",
      queueId: overrides.queueId ?? "queue_needs_review",
      assignedTo: overrides.assignedTo ?? "unassigned",
      requestedBy: overrides.requestedBy ?? "owner",
      source: overrides.source ?? "seed",
      dueAt: overrides.dueAt ?? NOW,
      createdAt: overrides.createdAt ?? NOW,
      updatedAt: overrides.updatedAt ?? NOW,
      completedAt: overrides.completedAt ?? null,
      blockedReason: overrides.blockedReason ?? null,
      relatedObjects: overrides.relatedObjects ?? [],
      requirements: overrides.requirements ?? [],
      metadata: overrides.metadata ?? {},
    },
  };
}

function makeEvent({ id, timestampISO, type, source, payload }) {
  return { id, timestampISO, type, source, payload };
}

test("WorkRuntime: initializes deterministic frozen seed + metrics", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  assert.ok(Object.isFrozen(rt._state));
  assert.equal(rt.getWorkItems().length, 0);
  assert.equal(rt.getStages().length, 6);
  assert.equal(rt.getQueues().length, 7);
  assert.equal(rt.getMetrics().totalWork, 0);
  assert.equal(rt.getMetrics().openWork, 0);
  assert.equal(rt.getMetrics().assignedWork, 0);
});

test("WORK_ITEM_CREATED: adds work item and updates queue workItemIds", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_1", status: "new", queueId: "queue_needs_review" }),
    }),
  );

  const item = rt.getWorkItem("wi_1");
  assert.ok(item);
  assert.equal(item.queueId, "queue_needs_review");
  const queue = rt.getQueues().find((q) => q.id === "queue_needs_review");
  assert.ok(queue);
  assert.deepEqual(queue.workItemIds, ["wi_1"]);
});

test("WORK_ITEM_STATUS_CHANGED: updates status and metrics open/completed/work", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_2",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_2", status: "ready" }),
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_wi_status_changed_2",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_STATUS_CHANGED,
      source: "test",
      payload: { workItemId: "wi_2", status: "completed", completedAtISO: NOW },
    }),
  );

  const item = rt.getWorkItem("wi_2");
  assert.equal(item.status, "completed");
  assert.equal(item.completedAt, NOW);
  assert.equal(rt.getMetrics().completedWork, 1);
  assert.equal(rt.getMetrics().openWork, 0);
});

test("WORK_ITEM_STAGE_CHANGED: updates stageId", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_3",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_3", stageId: "stage_intake" }),
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_wi_stage_changed_3",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_STAGE_CHANGED,
      source: "test",
      payload: { workItemId: "wi_3", stageId: "stage_review" },
    }),
  );

  const item = rt.getWorkItem("wi_3");
  assert.equal(item.stageId, "stage_review");
});

test("WORK_ITEM_ASSIGNED: adds assignment and metrics assignedWork increments", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_4",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_4", assignedTo: "unassigned" }),
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_assignment_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
      source: "test",
      payload: {
        assignment: {
          id: "wa_1",
          workItemId: "wi_4",
          assigneeId: "tm_1",
          assigneeType: "human",
          assignedAt: NOW,
          assignedBy: "unit_test",
          status: "active",
          metadata: {},
        },
      },
    }),
  );

  const item = rt.getWorkItem("wi_4");
  assert.equal(item.assignedTo, "tm_1");
  assert.equal(rt.getMetrics().assignedWork, 1);
});

test("WORK_ITEM_BLOCKED + UNBLOCKED: updates blockedReason and status", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_5",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_5", status: "in_progress" }),
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_wi_blocked_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_BLOCKED,
      source: "test",
      payload: { workItemId: "wi_5", blockedReason: "waiting on dependencies" },
    }),
  );

  let item = rt.getWorkItem("wi_5");
  assert.equal(item.status, "blocked");
  assert.equal(item.blockedReason, "waiting on dependencies");
  assert.equal(rt.getMetrics().blockedWork, 1);

  rt.applyEvent(
    makeEvent({
      id: "evt_wi_unblocked_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_UNBLOCKED,
      source: "test",
      payload: { workItemId: "wi_5", nextStatus: "ready" },
    }),
  );

  item = rt.getWorkItem("wi_5");
  assert.equal(item.status, "ready");
  assert.equal(item.blockedReason, null);
});

test("WORK_ITEM_COMPLETED: sets completedAt + completion updates metrics", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_6",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_6", status: "in_progress" }),
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_wi_completed_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_COMPLETED,
      source: "test",
      payload: { workItemId: "wi_6", completedAtISO: NOW },
    }),
  );

  const item = rt.getWorkItem("wi_6");
  assert.equal(item.status, "completed");
  assert.equal(item.completedAt, NOW);
  assert.equal(rt.getMetrics().completedWork, 1);
  assert.equal(rt.getMetrics().openWork, 0);
});

test("Work metrics: overdueWork counts dueAt in the past for non-completed statuses", () => {
  const past = "2026-06-30T00:00:00.000Z";
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_7",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_7", status: "in_progress", dueAt: past }),
    }),
  );

  assert.equal(rt.getMetrics().overdueWork, 1);
});

test("Immutability: runtime state remains frozen after events", () => {
  const rt = new WorkRuntime({ nowISO: NOW });
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_created_8",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: baseWorkPayload({ id: "wi_8", status: "new" }),
    }),
  );

  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getWorkItems()));
  assert.ok(Object.isFrozen(rt.getStages()));
  assert.ok(Object.isFrozen(rt.getQueues()));
  assert.ok(Object.isFrozen(rt.getAssignments()));
});

