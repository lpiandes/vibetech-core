import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { buildWorkItemForSeed } from "../../work/WorkBuilder.js";

import { PlatformEventBuilder } from "../../events/PlatformEventBuilder.js";
import { createTeamMember } from "../../team/TeamMember.js";
import { createTeamDepartment } from "../../team/TeamDepartment.js";
import { createTeamRole } from "../../team/TeamRole.js";
import { createTeamMetrics } from "../../team/TeamMetrics.js";
import { TeamRuntime } from "../../team/TeamRuntime.js";

import { AssignmentService } from "./AssignmentService.js";
import { ASSIGNMENT_STATUSES } from "./AssignmentDefaults.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const WORK_CREATED_AT = "2026-07-02T00:00:00.000Z";

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

  const totals = builtMembers.reduce(
    (acc, m) => {
      acc.capacity += Number(m?.metrics?.capacity ?? 0);
      return acc;
    },
    { capacity: 0 },
  );
  const capacity = totals.capacity || 100;
  const utilization = 0;
  const availability = 100;
  const metrics = createTeamMetrics({
    assignedWork: 0,
    completedWork: 0,
    pendingWork: 0,
    capacity,
    utilization,
    availability,
    metadata: {},
  });

  return new TeamRuntime({
    seed: () =>
      ({
        members: builtMembers,
        departments: [dept],
        roles: [role],
        status: "available",
        metrics,
        recommendations: [],
      }),
  });
}

function makeWorkRuntimeWithWorkItem({ workItemId, workType, assignedTo, nowISO = NOW_ISO } = {}) {
  const runtime = new WorkRuntime({ nowISO });
  const workItem = buildWorkItemForSeed({
    nowISO,
    overrides: {
      id: workItemId,
      workType,
      assignedTo: assignedTo ?? "unassigned",
      createdAt: WORK_CREATED_AT,
      updatedAt: WORK_CREATED_AT,
      title: "Work",
      description: "Work description",
      metadata: {},
      dueAt: null,
    },
  });

  runtime.applyEvent({
    id: `evt_work_item_created_${workItemId}`,
    timestampISO: WORK_CREATED_AT,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem },
  });

  return runtime;
}

function makeWorkCreatedPlatformEvent({ workItemId, workType, assignedTo, occurredAt = WORK_CREATED_AT } = {}) {
  const builder = new PlatformEventBuilder({ nowISO: NOW_ISO });
  return builder.build({
    eventId: `evt_work_created_${workItemId}`,
    eventType: "WORK_CREATED",
    version: 1,
    occurredAt: occurredAt,
    publisher: "work_os",
    aggregateType: "work",
    aggregateId: workItemId,
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
      assignedTo: assignedTo ?? "unassigned",
      requestedBy: "owner_1",
      source: "demo-seed",
      createdAt: occurredAt,
      relatedObjects: [],
      metadata: {},
    },
    metadata: {},
  });
}

test("Successful assignment: matching digital employee wins deterministically", () => {
  const teamRuntime = makeTeamRuntime({
    members: [
      {
        id: "tm_digital_1",
        name: "Digital A",
        memberType: "digital_employee",
        roleId: "role_digital_intake",
        skills: ["intake"],
        permissions: [],
      },
      {
        id: "tm_human_1",
        name: "Human A",
        memberType: "human",
        roleId: "role_human_intake",
        skills: ["intake"],
        permissions: [],
      },
    ],
  });

  const workRuntime = makeWorkRuntimeWithWorkItem({ workItemId: "work_1", workType: "intake", assignedTo: "unassigned" });
  const workCreatedEvent = makeWorkCreatedPlatformEvent({ workItemId: "work_1", workType: "intake", assignedTo: "unassigned" });

  const service = new AssignmentService();
  const result = service.assignOwnership({ workRuntime, teamRuntime, workCreatedEvent });

  assert.equal(result.status, ASSIGNMENT_STATUSES.ASSIGNED);
  assert.equal(result.assignmentReason, "matching_digital_employee");
  assert.equal(result.assigneeId, "tm_digital_1");
  assert.equal(result.runtimeUpdated, true);

  const assignments = workRuntime.getAssignments();
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].assigneeId, "tm_digital_1");
});

test("Already assigned: service returns already_assigned and runtimeUpdated=false", () => {
  const teamRuntime = makeTeamRuntime({
    members: [
      {
        id: "tm_digital_1",
        memberType: "digital_employee",
        roleId: "role_digital_intake",
        skills: ["intake"],
      },
      {
        id: "tm_human_9",
        memberType: "human",
        roleId: "role_human_intake",
        skills: ["intake"],
      },
    ],
  });

  const workRuntime = makeWorkRuntimeWithWorkItem({ workItemId: "work_2", workType: "intake", assignedTo: "unassigned" });

  // Pre-seed an active assignment to simulate "already assigned".
  workRuntime.applyEvent({
    id: "evt_seed_assigned",
    timestampISO: WORK_CREATED_AT,
    type: WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED,
    source: "test",
    payload: {
      assignment: {
        id: "assign_work_2_tm_human_9",
        workItemId: "work_2",
        assigneeId: "tm_human_9",
        assigneeType: "human",
        assignedAt: WORK_CREATED_AT,
        assignedBy: "test",
        status: "active",
        metadata: {},
      },
    },
  });

  const workCreatedEvent = makeWorkCreatedPlatformEvent({ workItemId: "work_2", workType: "intake", assignedTo: "unassigned" });
  const service = new AssignmentService();
  const result = service.assignOwnership({ workRuntime, teamRuntime, workCreatedEvent });

  assert.equal(result.status, ASSIGNMENT_STATUSES.ASSIGNED);
  assert.equal(result.assignmentReason, "already_assigned");
  assert.equal(result.runtimeUpdated, false);
  assert.equal(workRuntime.getAssignments().length, 1);
  assert.equal(workRuntime.getAssignments()[0].assigneeId, "tm_human_9");
});

test("No candidates: UNASSIGNED is produced and WorkRuntime is still updated", () => {
  const teamRuntime = makeTeamRuntime({
    members: [
      {
        id: "tm_digital_x",
        memberType: "digital_employee",
        roleId: "role_digital_other",
        skills: ["other"],
        permissions: [],
      },
      {
        id: "tm_human_x",
        memberType: "human",
        roleId: "role_human_other",
        skills: ["other"],
        permissions: [],
      },
    ],
  });

  const workRuntime = makeWorkRuntimeWithWorkItem({ workItemId: "work_3", workType: "intake", assignedTo: "unassigned" });
  const workCreatedEvent = makeWorkCreatedPlatformEvent({ workItemId: "work_3", workType: "intake", assignedTo: "unassigned" });

  const service = new AssignmentService();
  const result = service.assignOwnership({ workRuntime, teamRuntime, workCreatedEvent });

  assert.equal(result.status, ASSIGNMENT_STATUSES.UNASSIGNED);
  assert.equal(result.assigneeId, "unassigned");
  assert.equal(result.assignmentReason, "unassigned");
  assert.equal(result.runtimeUpdated, true);

  const assignments = workRuntime.getAssignments();
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].assigneeId, "unassigned");
});

test("Candidate selection order: explicit assignedTo overrides digital/human matching", () => {
  const teamRuntime = makeTeamRuntime({
    members: [
      {
        id: "tm_digital_1",
        memberType: "digital_employee",
        roleId: "role_digital_intake",
        skills: ["intake"],
      },
      {
        id: "tm_human_1",
        memberType: "human",
        roleId: "role_human_intake",
        skills: ["intake"],
      },
    ],
  });

  const workRuntime = makeWorkRuntimeWithWorkItem({ workItemId: "work_4", workType: "intake", assignedTo: "tm_human_1" });
  const workCreatedEvent = makeWorkCreatedPlatformEvent({ workItemId: "work_4", workType: "intake", assignedTo: "tm_human_1" });

  const service = new AssignmentService();
  const result = service.assignOwnership({ workRuntime, teamRuntime, workCreatedEvent });

  assert.equal(result.status, ASSIGNMENT_STATUSES.ASSIGNED);
  assert.equal(result.assigneeId, "tm_human_1");
  assert.equal(result.assignmentReason, "explicit_assigned_to");
});

test("Candidate selection order: if no explicit assignedTo, digital match wins over human match", () => {
  const teamRuntime = makeTeamRuntime({
    members: [
      {
        id: "tm_digital_2",
        memberType: "digital_employee",
        roleId: "role_digital_intake",
        skills: ["intake"],
      },
      {
        id: "tm_human_2",
        memberType: "human",
        roleId: "role_human_intake",
        skills: ["intake"],
      },
    ],
  });

  const workRuntime = makeWorkRuntimeWithWorkItem({ workItemId: "work_5", workType: "intake", assignedTo: "unassigned" });
  const workCreatedEvent = makeWorkCreatedPlatformEvent({ workItemId: "work_5", workType: "intake", assignedTo: "unassigned" });

  const service = new AssignmentService();
  const result = service.assignOwnership({ workRuntime, teamRuntime, workCreatedEvent });

  assert.equal(result.status, ASSIGNMENT_STATUSES.ASSIGNED);
  assert.equal(result.assigneeId, "tm_digital_2");
  assert.equal(result.assignmentReason, "matching_digital_employee");
});

