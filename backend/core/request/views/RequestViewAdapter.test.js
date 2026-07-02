import assert from "node:assert/strict";
import { test } from "node:test";

import { RequestRuntime } from "../RequestRuntime.js";
import { REQUEST_EVENT_TYPES } from "../RequestEventTypes.js";
import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";
import { TeamRuntime } from "../../team/TeamRuntime.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";

import { RequestViewAdapter } from "./RequestViewAdapter.js";
import { ATTENTION_CATEGORIES, ACTION_TYPES } from "./RequestViewDefaults.js";

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
    status: overrides.status ?? "received",
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

function createWorkItem(overrides = {}) {
  const createdAt = overrides.createdAt ?? NOW;
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
    dueAt: overrides.dueAt === undefined ? null : overrides.dueAt,
    createdAt,
    updatedAt,
    completedAt: overrides.completedAt ?? null,
    blockedReason: overrides.blockedReason ?? null,
    relatedObjects: overrides.relatedObjects ?? [],
    requirements: overrides.requirements ?? [],
    metadata: overrides.metadata ?? {},
  };
}

function buildRuntimes() {
  const requestRuntime = new RequestRuntime({ nowISO: NOW });
  const companyRuntime = new CompanyWorkspaceRuntime();
  const teamRuntime = new TeamRuntime();
  const workRuntime = new WorkRuntime({ nowISO: NOW });

  const teamMemberId = String(teamRuntime.getMembers()[0].id);

  // Related work item: blocked.
  workRuntime.applyEvent(
    makeEvent({
      id: "evt_work_blocked_1",
      timestampISO: NOW,
      type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
      source: "test",
      payload: { workItem: createWorkItem({ id: "work_blocked_1", status: "blocked", assignedTo: teamMemberId, dueAt: "2026-06-20T00:00:00.000Z" }) },
    }),
  );

  // r1: received + high priority => attention new_unreviewed + high_priority
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_received_1",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r_received_high", priority: "high", status: "received" }) },
    }),
  );

  // r2: qualified + unassigned (no assigned team/work) => qualified_not_converted + missing_assignment + convert_to_work nextAction.
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_received_2",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r_qualified_unassigned_1", priority: "medium", status: "received" }) },
    }),
  );
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_qualified_2",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r_qualified_unassigned_1", qualificationStatus: "triaged" },
    }),
  );

  // r3 + r4: additional qualified unassigned to reach conversion backlog threshold.
  for (const i of [3, 4]) {
    const rid = `r_qualified_unassigned_${i}`;
    requestRuntime.applyEvent(
      makeEvent({
        id: `evt_req_received_${i}`,
        timestampISO: NOW,
        type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
        payload: { request: baseRequestPayload({ id: rid, priority: "medium", status: "received" }) },
      }),
    );
    requestRuntime.applyEvent(
      makeEvent({
        id: `evt_req_qualified_${i}`,
        timestampISO: NOW,
        type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
        payload: { requestId: rid, qualificationStatus: "ok" },
      }),
    );
  }

  // r5: qualified with related blocked work => failed_blocked_related_work.
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_received_5",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: {
        request: baseRequestPayload({
          id: "r_related_work_failed",
          priority: "medium",
          assignedWorkId: "work_blocked_1",
          status: "received",
        }),
      },
    }),
  );
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_qualified_5",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r_related_work_failed", qualificationStatus: "ok" },
    }),
  );

  // r6: qualified + overdue => overdue_requests attention.
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_received_6",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: { request: baseRequestPayload({ id: "r_overdue", dueAt: "2026-06-20T00:00:00.000Z", status: "received" }) },
    }),
  );
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_qualified_6",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r_overdue", qualificationStatus: "ok" },
    }),
  );

  // r_wait_old: received long ago, qualified unassigned => waiting too long.
  const OLD = "2026-06-25T00:00:00.000Z"; // > 48h before NOW
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_received_wait_old",
      timestampISO: OLD,
      type: REQUEST_EVENT_TYPES.REQUEST_RECEIVED,
      payload: {
        request: baseRequestPayload({
          id: "r_wait_old",
          priority: "medium",
          status: "received",
          dueAt: null,
        }),
      },
    }),
  );
  requestRuntime.applyEvent(
    makeEvent({
      id: "evt_req_qualified_wait_old",
      timestampISO: NOW,
      type: REQUEST_EVENT_TYPES.REQUEST_QUALIFIED,
      payload: { requestId: "r_wait_old", qualificationStatus: "ok" },
    }),
  );

  return { requestRuntime, companyRuntime, teamRuntime, workRuntime };
}

test("RequestViewAdapter: deterministic, immutable, validated, and does not mutate runtimes", () => {
  const { requestRuntime, companyRuntime, teamRuntime, workRuntime } = buildRuntimes();
  const adapter = new RequestViewAdapter({ nowISO: NOW });

  const before = {
    req: JSON.parse(JSON.stringify(requestRuntime.getRequests())),
    work: JSON.parse(JSON.stringify(workRuntime.getWorkItems())),
    team: JSON.parse(JSON.stringify(teamRuntime.getMembers())),
    company: JSON.parse(JSON.stringify(companyRuntime.getCompany())),
  };

  const vmA = adapter.translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime });
  const vmB = adapter.translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime });

  assert.deepEqual(vmA, vmB);
  assert.ok(Object.isFrozen(vmA));
  assert.ok(Object.isFrozen(vmA.items));
  assert.ok(Object.isFrozen(vmA.queues));
  assert.ok(Object.isFrozen(vmA.attention));
  assert.ok(Object.isFrozen(vmA.recommendedActions));

  assert.deepEqual(JSON.parse(JSON.stringify(requestRuntime.getRequests())), before.req);
  assert.deepEqual(JSON.parse(JSON.stringify(workRuntime.getWorkItems())), before.work);
  assert.deepEqual(JSON.parse(JSON.stringify(teamRuntime.getMembers())), before.team);
  assert.deepEqual(JSON.parse(JSON.stringify(companyRuntime.getCompany())), before.company);
});

test("Queue generation: includes all default queues + correct membership", () => {
  const { requestRuntime, companyRuntime, teamRuntime, workRuntime } = buildRuntimes();
  const vm = new RequestViewAdapter({ nowISO: NOW }).translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime });

  const queueIds = vm.queues.map((q) => q.id);
  const expected = ["queue_new_requests", "queue_needs_review", "queue_qualified", "queue_ready_to_convert", "queue_converted", "queue_closed"];
  assert.deepEqual(queueIds, expected);

  const qNew = vm.queues.find((q) => q.id === "queue_new_requests");
  assert.ok(qNew.items.includes("r_received_high"));

  const qReady = vm.queues.find((q) => q.id === "queue_ready_to_convert");
  // qualified unassigned requests.
  assert.ok(qReady.items.includes("r_qualified_unassigned_1"));
  assert.ok(qReady.items.includes("r_qualified_unassigned_3"));
  assert.ok(qReady.items.includes("r_qualified_unassigned_4"));
});

test("Attention detection: includes key deterministic categories", () => {
  const { requestRuntime, companyRuntime, teamRuntime, workRuntime } = buildRuntimes();
  const vm = new RequestViewAdapter({ nowISO: NOW }).translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime });

  const cats = vm.attention.items.map((x) => x.category);
  for (const required of ATTENTION_CATEGORIES) {
    assert.ok(cats.includes(required), `missing attention category: ${required}`);
  }
});

test("Action generation + item nextAction: includes convert_to_work and view_related_work", () => {
  const { requestRuntime, companyRuntime, teamRuntime, workRuntime } = buildRuntimes();
  const vm = new RequestViewAdapter({ nowISO: NOW }).translate({ requestRuntime, companyRuntime, teamRuntime, workRuntime });

  const actionTypes = vm.recommendedActions.map((a) => a.type);
  assert.ok(actionTypes.includes(ACTION_TYPES.review_request));
  assert.ok(actionTypes.includes(ACTION_TYPES.convert_to_work));
  assert.ok(actionTypes.includes(ACTION_TYPES.assign_request));
  assert.ok(actionTypes.includes(ACTION_TYPES.view_related_work));
  assert.ok(actionTypes.includes(ACTION_TYPES.follow_up));

  const relatedItem = vm.items.find((x) => x.id === "r_related_work_failed");
  assert.ok(relatedItem.badges.some((b) => b.includes("blocked") || b.includes("failed")));
  assert.equal(relatedItem.nextAction, ACTION_TYPES.view_related_work);

  const qualifiedUnassigned = vm.items.find((x) => x.id === "r_qualified_unassigned_1");
  assert.equal(qualifiedUnassigned.nextAction, ACTION_TYPES.convert_to_work);

  const overdue = vm.items.find((x) => x.id === "r_overdue");
  assert.equal(overdue.nextAction, ACTION_TYPES.follow_up);
});

