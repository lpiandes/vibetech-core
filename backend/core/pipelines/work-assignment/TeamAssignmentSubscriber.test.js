import assert from "node:assert/strict";
import { test } from "node:test";

import { PlatformEventBus } from "../../events/bus/PlatformEventBus.js";
import { PlatformEventBuilder } from "../../events/PlatformEventBuilder.js";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { buildWorkItemForSeed } from "../../work/WorkBuilder.js";

import { TeamRuntime } from "../../team/TeamRuntime.js";
import { createTeamMember } from "../../team/TeamMember.js";
import { createTeamDepartment } from "../../team/TeamDepartment.js";
import { createTeamRole } from "../../team/TeamRole.js";
import { createTeamMetrics } from "../../team/TeamMetrics.js";

import { createTeamAssignmentSubscriber, teamAssignmentHandle } from "./TeamAssignmentSubscriber.js";
import { AssignmentService } from "./AssignmentService.js";
import { ASSIGNMENT_STATUSES } from "./AssignmentDefaults.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const WORK_CREATED_AT = "2026-07-02T00:00:00.000Z";

function makeWorkRuntime({ workItemId = "work_1", workType = "intake", assignedTo = "unassigned" } = {}) {
  const workRuntime = new WorkRuntime({ nowISO: NOW_ISO });
  const workItem = buildWorkItemForSeed({
    nowISO: NOW_ISO,
    overrides: {
      id: workItemId,
      title: "Work",
      description: "Work description",
      workType,
      status: "new",
      priority: "medium",
      stageId: "stage_intake",
      queueId: "queue_needs_review",
      assignedTo,
      requestedBy: "owner_1",
      source: "demo-seed",
      dueAt: null,
      createdAt: WORK_CREATED_AT,
      updatedAt: WORK_CREATED_AT,
      metadata: {},
    },
  });

  workRuntime.applyEvent({
    id: `evt_work_item_created_${workItemId}`,
    timestampISO: WORK_CREATED_AT,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem },
  });

  return workRuntime;
}

function makeTeamRuntime({ members } = {}) {
  const dept = createTeamDepartment({ id: "dept_1", name: "Dept 1", metadata: { seeded: true } });
  const role = createTeamRole({ id: "role_1", name: "Role 1", metadata: { seeded: true } });

  const builtMembers = (members ?? []).map((m) =>
    createTeamMember({
      id: m.id,
      name: m.name ?? m.id,
      memberType: m.memberType,
      departmentId: m.departmentId ?? dept.id,
      roleId: m.roleId ?? role.id,
      status: "available",
      availability: m.availability ?? 50,
      capacity: m.capacity ?? 50,
      workload: { assignedWork: 0, completedWork: 0, pendingWork: 0 },
      skills: m.skills ?? [],
      permissions: m.permissions ?? [],
      metrics: {
        assignedWork: 0,
        completedWork: 0,
        pendingWork: 0,
        capacity: m.capacity ?? 50,
        utilization: 0,
        availability: m.availability ?? 50,
      },
      metadata: {},
    }),
  );

  const capacity = builtMembers.reduce((a, m) => a + Number(m?.metrics?.capacity ?? 0), 0) || 100;
  const metrics = createTeamMetrics({
    assignedWork: 0,
    completedWork: 0,
    pendingWork: 0,
    capacity,
    utilization: 0,
    availability: 100,
    metadata: {},
  });

  return new TeamRuntime({
    seed: () => ({
      members: builtMembers,
      departments: [dept],
      roles: [role],
      status: "available",
      metrics,
      recommendations: [],
    }),
  });
}

function makeWorkCreatedPlatformEvent({ workItemId, workType, assignedTo, occurredAt = WORK_CREATED_AT } = {}) {
  const builder = new PlatformEventBuilder({ nowISO: NOW_ISO });
  return builder.build({
    eventId: `evt_work_created_${workItemId}`,
    eventType: "WORK_CREATED",
    version: 1,
    occurredAt,
    publisher: "work_os",
    aggregateType: "work",
    aggregateId: String(workItemId),
    correlationId: "corr_1",
    causationId: "cause_1",
    payload: {
      workItemId: String(workItemId),
      title: "Work",
      description: "Work description",
      workType: String(workType),
      status: "new",
      priority: "medium",
      stageId: "stage_intake",
      queueId: "queue_needs_review",
      assignedTo: String(assignedTo ?? "unassigned"),
      requestedBy: "owner_1",
      source: "demo-seed",
      createdAt: occurredAt,
      relatedObjects: [],
      metadata: {},
    },
    metadata: {},
  });
}

test("subscriber creation: creates frozen bus-compatible subscriber", () => {
  const workRuntime = makeWorkRuntime({ workItemId: "work_1" });
  const teamRuntime = makeTeamRuntime({ members: [{ id: "tm_1", memberType: "human", roleId: "role_1", skills: ["intake"], permissions: ["manager"] }] });

  const subscriber = createTeamAssignmentSubscriber({ workRuntime, teamRuntime });
  assert.ok(Object.isFrozen(subscriber));
  assert.equal(subscriber.supportedEvents[0], "WORK_CREATED");
  assert.equal(typeof subscriber.handle, "function");
});

test("missing team runtime: handler returns FAILED", () => {
  const workRuntime = makeWorkRuntime({ workItemId: "work_2" });
  const event = makeWorkCreatedPlatformEvent({ workItemId: "work_2", workType: "intake", assignedTo: "unassigned" });

  const res = teamAssignmentHandle(event, { workRuntime, teamRuntime: null });
  assert.equal(res.status, "FAILED");
  assert.ok(res.errors.length > 0);
});

test("missing work runtime: handler returns FAILED", () => {
  const teamRuntime = makeTeamRuntime({ members: [{ id: "tm_1", memberType: "human", roleId: "role_1", skills: ["intake"], permissions: ["manager"] }] });
  const event = makeWorkCreatedPlatformEvent({ workItemId: "work_3", workType: "intake", assignedTo: "unassigned" });

  const res = teamAssignmentHandle(event, { workRuntime: null, teamRuntime });
  assert.equal(res.status, "FAILED");
  assert.ok(res.errors.length > 0);
});

test("successful assignment integration: bus dispatch updates WorkRuntime", () => {
  const workItemId = "work_bus_1";
  const workRuntime = makeWorkRuntime({ workItemId, workType: "intake", assignedTo: "unassigned" });
  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_d1", memberType: "digital_employee", roleId: "role_digital_intake", skills: ["intake"], permissions: [] },
      { id: "tm_h1", memberType: "human", roleId: "role_human_intake", skills: ["intake"], permissions: [] },
    ],
  });

  const subscriber = createTeamAssignmentSubscriber({ workRuntime, teamRuntime });
  const bus = new PlatformEventBus({ nowISO: NOW_ISO });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber });

  const event = makeWorkCreatedPlatformEvent({ workItemId, workType: "intake", assignedTo: "unassigned" });
  const report = bus.dispatch(event, { dispatchedAtISO: NOW_ISO });

  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 0);
  const updatedItem = workRuntime.getWorkItem(workItemId);
  assert.equal(updatedItem.assignedTo, "tm_d1");
  assert.equal(workRuntime.getAssignments().length, 1);
});

test("runtime updated + unassigned when no candidates: assignments still created", () => {
  const workItemId = "work_unassigned_1";
  const workRuntime = makeWorkRuntime({ workItemId, workType: "intake", assignedTo: "unassigned" });

  // No matches and no manager permissions.
  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_dX", memberType: "digital_employee", roleId: "role_digital_other", skills: ["other"], permissions: [] },
      { id: "tm_hX", memberType: "human", roleId: "role_human_other", skills: ["other"], permissions: [] },
    ],
  });

  const subscriber = createTeamAssignmentSubscriber({ workRuntime, teamRuntime });
  const bus = new PlatformEventBus({ nowISO: NOW_ISO });
  bus.subscribe({ eventType: "WORK_CREATED", subscriber });

  const event = makeWorkCreatedPlatformEvent({ workItemId, workType: "intake", assignedTo: "unassigned" });
  const report = bus.dispatch(event, { dispatchedAtISO: NOW_ISO });

  assert.equal(report.successCount, 1);
  assert.equal(workRuntime.getAssignments().length, 1);
  assert.equal(workRuntime.getWorkItem(workItemId).assignedTo, "unassigned");
});

test("immutability: AssignmentService returns frozen AssignmentResult in subscriber metadata", () => {
  const workItemId = "work_immut_1";
  const workRuntime = makeWorkRuntime({ workItemId, workType: "intake", assignedTo: "unassigned" });
  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_d1", memberType: "digital_employee", roleId: "role_digital_intake", skills: ["intake"], permissions: [] }],
  });
  const subscriber = createTeamAssignmentSubscriber({ workRuntime, teamRuntime });

  const event = makeWorkCreatedPlatformEvent({ workItemId, workType: "intake", assignedTo: "unassigned" });
  const handled = subscriber.handle(event);

  assert.ok(Object.isFrozen(handled));
  const assignmentResult = handled.metadata.assignmentResult;
  assert.ok(Object.isFrozen(assignmentResult));
  assert.equal(assignmentResult.status, ASSIGNMENT_STATUSES.ASSIGNED);

  // Ensure nested errors array is frozen too (deep immutability).
  assert.ok(Array.isArray(assignmentResult.errors));
  assert.ok(Object.isFrozen(assignmentResult.errors));
});

