import assert from "node:assert/strict";
import { test } from "node:test";

import { TeamRuntime } from "../../team/TeamRuntime.js";
import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { WorkRuntime } from "../WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../WorkEventTypes.js";
import { WorkViewAdapter } from "./WorkViewAdapter.js";
import { validateWorkViewModel } from "./WorkViewValidator.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeEvent({ id, timestampISO, type, source, payload }) {
  return { id, timestampISO, type, source, payload };
}

function makeWorkItem(overrides = {}) {
  const createdAt = overrides.createdAt ?? NOW0;
  const updatedAt = overrides.updatedAt ?? createdAt;
  return {
    id: overrides.id ?? "wi_1",
    title: overrides.title ?? "Work item",
    description: overrides.description ?? "Deterministic work item.",
    workType: overrides.workType ?? "inquiry",
    status: overrides.status ?? "new",
    priority: overrides.priority ?? "medium",
    stageId: overrides.stageId ?? "stage_intake",
    queueId: overrides.queueId ?? "queue_needs_review",
    assignedTo: overrides.assignedTo ?? "unassigned",
    requestedBy: overrides.requestedBy ?? "owner",
    source: overrides.source ?? "seed",
    dueAt: overrides.dueAt ?? null,
    createdAt,
    updatedAt,
    completedAt: overrides.completedAt ?? null,
    blockedReason: overrides.blockedReason ?? null,
    relatedObjects: overrides.relatedObjects ?? [],
    requirements: overrides.requirements ?? [],
    metadata: overrides.metadata ?? {},
  };
}

function buildWorkRuntimeWithAttention() {
  const rt = new WorkRuntime({ nowISO: NOW0 });

  // Blocked work -> blocked_work
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_blocked_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_blocked_1", status: "blocked", dueAt: "2026-06-20T00:00:00.000Z", stageId: "stage_review" }) },
    }),
  );

  rt.applyEvent(
    makeEvent({
      id: "evt_assignment_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
      source: "test",
      payload: {
        assignment: {
          id: "wa_1",
          workItemId: "wi_blocked_1",
          assigneeId: "tm_ceo",
          assigneeType: "human",
          assignedAt: NOW0,
          assignedBy: "unit_test",
          status: "active",
          metadata: {},
        },
      },
    }),
  );

  // Failed work -> failed_work
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_failed_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_failed_1", status: "failed", assignedTo: "tm_ceo", dueAt: "2026-06-20T00:00:00.000Z" }) },
    }),
  );

  // Review required + overdue -> review_required_work + overdue_work
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_review_required_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: {
        workItem: makeWorkItem({
          id: "wi_review_required_1",
          status: "review_required",
          dueAt: "2026-06-30T00:00:00.000Z",
          stageId: "stage_review",
          queueId: "queue_needs_review",
          assignedTo: "unassigned",
        }),
      },
    }),
  );

  // Unassigned work -> unassigned_work
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_unassigned_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_unassigned_1", status: "ready", queueId: "queue_in_progress", assignedTo: "unassigned" }) },
    }),
  );

  // Work waiting too long -> work_waiting_too_long
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_waiting_old_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: {
        workItem: makeWorkItem({
          id: "wi_waiting_old_1",
          status: "waiting",
          createdAt: "2026-06-20T00:00:00.000Z",
          updatedAt: "2026-06-20T00:00:00.000Z",
          queueId: "queue_needs_review",
          assignedTo: "tm_ceo",
        }),
      },
    }),
  );

  // Missing assignee -> missing_assignees
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_missing_assignee_1",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: {
        workItem: makeWorkItem({
          id: "wi_missing_assignee_1",
          status: "in_progress",
          queueId: "queue_in_progress",
          assignedTo: "tm_missing",
        }),
      },
    }),
  );

  // Queue growth -> queues_growing_too_large in queue_needs_review.
  // Threshold in adapter is >=4.
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_queue_growth_2",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_qg_2", status: "ready", queueId: "queue_needs_review", assignedTo: "unassigned" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_queue_growth_3",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_qg_3", status: "ready", queueId: "queue_needs_review", assignedTo: "unassigned" }) },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_wi_queue_growth_4",
      timestampISO: NOW0,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: makeWorkItem({ id: "wi_qg_4", status: "ready", queueId: "queue_needs_review", assignedTo: "unassigned" }) },
    }),
  );

  return rt;
}

function buildTeamAndCompany() {
  const teamRuntime = new TeamRuntime();
  const companyRuntime = new CompanyWorkspaceRuntime();
  return { teamRuntime, companyRuntime };
}

test("Work view generation: deterministic, immutable, and validated", () => {
  const workRuntime = buildWorkRuntimeWithAttention();
  const { teamRuntime, companyRuntime } = buildTeamAndCompany();

  const adapter = new WorkViewAdapter({ nowISO: NOW0 });

  const beforeWork = JSON.parse(JSON.stringify(workRuntime.getWorkItems()));
  const beforeQueues = JSON.parse(JSON.stringify(workRuntime.getQueues()));
  const beforeAssignments = JSON.parse(JSON.stringify(workRuntime.getAssignments()));

  const vmA = adapter.translate({ workRuntime, teamRuntime, companyRuntime });
  const vmB = adapter.translate({ workRuntime, teamRuntime, companyRuntime });

  assert.deepEqual(vmA, vmB);
  assert.ok(Object.isFrozen(vmA));
  assert.ok(Object.isFrozen(vmA.items));
  assert.ok(Object.isFrozen(vmA.queues));
  assert.ok(Object.isFrozen(vmA.attention));

  assert.deepEqual(JSON.parse(JSON.stringify(workRuntime.getWorkItems())), beforeWork);
  assert.deepEqual(JSON.parse(JSON.stringify(workRuntime.getQueues())), beforeQueues);
  assert.deepEqual(JSON.parse(JSON.stringify(workRuntime.getAssignments())), beforeAssignments);

  assert.deepEqual(validateWorkViewModel(vmA), { ok: true });
});

test("Attention detection: includes key categories", () => {
  const workRuntime = buildWorkRuntimeWithAttention();
  const { teamRuntime, companyRuntime } = buildTeamAndCompany();
  const vm = new WorkViewAdapter({ nowISO: NOW0 }).translate({ workRuntime, teamRuntime, companyRuntime });

  const categories = vm.attention.items.map((x) => x.category);
  assert.ok(categories.includes("blocked_work"));
  assert.ok(categories.includes("failed_work"));
  assert.ok(categories.includes("review_required_work"));
  assert.ok(categories.includes("overdue_work"));
  assert.ok(categories.includes("unassigned_work"));
  assert.ok(categories.includes("work_waiting_too_long"));
  assert.ok(categories.includes("queues_growing_too_large"));
  assert.ok(categories.includes("missing_assignees"));
});

test("Action generation: recommended actions include unblock/review/assign/follow-up", () => {
  const workRuntime = buildWorkRuntimeWithAttention();
  const { teamRuntime, companyRuntime } = buildTeamAndCompany();
  const vm = new WorkViewAdapter({ nowISO: NOW0 }).translate({ workRuntime, teamRuntime, companyRuntime });

  const types = vm.recommendedActions.map((a) => a.type);
  assert.ok(types.includes("unblock_work"));
  assert.ok(types.includes("review_work"));
  assert.ok(types.includes("assign_work"));
  assert.ok(types.includes("follow_up"));
});

test("Item view enrichment: blocked item has attentionRequired + nextAction", () => {
  const workRuntime = buildWorkRuntimeWithAttention();
  const { teamRuntime, companyRuntime } = buildTeamAndCompany();
  const vm = new WorkViewAdapter({ nowISO: NOW0 }).translate({ workRuntime, teamRuntime, companyRuntime });

  const item = vm.items.find((x) => x.id === "wi_blocked_1");
  assert.ok(item);
  assert.equal(item.attentionRequired, true);
  assert.equal(item.nextAction, "unblock_work");
  assert.ok(item.badges.includes("Blocked"));
});

