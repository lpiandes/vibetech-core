import assert from "node:assert/strict";
import { test } from "node:test";

import { TeamRuntime } from "./TeamRuntime.js";
import { buildDefaultTeamSeed } from "./TeamBuilder.js";
import { validateTeamRuntime } from "./TeamRuntimeValidator.js";

import { TeamEventEngine } from "./TeamEventEngine.js";
import { TEAM_EVENT_TYPES } from "./TeamEventTypes.js";

const TS = "2026-07-01T00:00:00.000Z";

function makeEvent({ id, type, source, payload }) {
  return {
    id,
    timestampISO: TS,
    type,
    source,
    payload,
  };
}

test("TeamRuntime creation: deterministic seed + deep frozen", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getMembers()));
  assert.ok(Object.isFrozen(rt.getDepartments()));
  assert.ok(Object.isFrozen(rt.getRoles()));
  assert.deepEqual(validateTeamRuntime(rt), { ok: true });
});

test("Events: member creation updates members immutably", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const prevCount = rt.getMembers().length;

  const eng = new TeamEventEngine({ runtime: rt });
  eng.apply(
    makeEvent({
      id: "evt_tm_create_1",
      type: TEAM_EVENT_TYPES.TEAM_MEMBER_CREATED,
      source: "test",
      payload: {
        member: {
          id: "tm_test_member_1",
          name: "Test Member",
          memberType: "human",
          departmentId: rt.getDepartments()[0].id,
          roleId: rt.getRoles()[0].id,
          status: "available",
          availability: 80,
          capacity: 80,
          workload: { assignedWork: 0, completedWork: 0, pendingWork: 0 },
          skills: ["triage"],
          permissions: ["employee"],
          metrics: {},
          metadata: {},
        },
      },
    }),
  );

  assert.equal(rt.getMembers().length, prevCount + 1);
  const created = rt.getMembers().find((m) => m.id === "tm_test_member_1");
  assert.ok(created);
  assert.equal(created.status, "available");
  assert.ok(Object.isFrozen(created));
});

test("Events: status change updates member status", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const m = rt.getMembers()[0];
  rt.applyEvent(
    makeEvent({
      id: "evt_status_1",
      type: TEAM_EVENT_TYPES.TEAM_STATUS_CHANGED,
      source: "test",
      payload: { memberId: m.id, status: "busy" },
    }),
  );

  const after = rt.getMembers().find((x) => x.id === m.id);
  assert.equal(after.status, "busy");
  assert.ok(Object.isFrozen(after));
});

test("Events: department creation and role creation append unique immutable entries", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const prevDeps = rt.getDepartments().length;
  const prevRoles = rt.getRoles().length;

  rt.applyEvent(
    makeEvent({
      id: "evt_dept_create_1",
      type: TEAM_EVENT_TYPES.TEAM_DEPARTMENT_CREATED,
      source: "test",
      payload: { department: { id: "dept_test_1", name: "Test Dept", metadata: {} } },
    }),
  );
  rt.applyEvent(
    makeEvent({
      id: "evt_role_create_1",
      type: TEAM_EVENT_TYPES.TEAM_ROLE_CREATED,
      source: "test",
      payload: { role: { id: "role_test_1", name: "Test Role", metadata: {} } },
    }),
  );

  assert.equal(rt.getDepartments().length, prevDeps + 1);
  assert.equal(rt.getRoles().length, prevRoles + 1);

  const dept = rt.getDepartments().find((d) => d.id === "dept_test_1");
  const role = rt.getRoles().find((r) => r.id === "role_test_1");
  assert.ok(dept);
  assert.ok(role);
  assert.ok(Object.isFrozen(dept));
  assert.ok(Object.isFrozen(role));
});

test("Events: member updated changes fields deterministically", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const m = rt.getMembers()[0];

  rt.applyEvent(
    makeEvent({
      id: "evt_member_update_1",
      type: TEAM_EVENT_TYPES.TEAM_MEMBER_UPDATED,
      source: "test",
      payload: {
        memberId: m.id,
        patch: { status: "away", availability: 10, capacity: 10, workload: { assignedWork: 1, completedWork: 1, pendingWork: 1 } },
      },
    }),
  );

  const after = rt.getMembers().find((x) => x.id === m.id);
  assert.equal(after.status, "away");
  assert.equal(after.capacity, 10);
  assert.equal(after.workload.pendingWork, 1);
  assert.ok(Object.isFrozen(after));
});

test("Events: member archived sets offline and zeros pending/assigned work", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const m = rt.getMembers()[0];

  rt.applyEvent(
    makeEvent({
      id: "evt_member_archive_1",
      type: TEAM_EVENT_TYPES.TEAM_MEMBER_ARCHIVED,
      source: "test",
      payload: { memberId: m.id },
    }),
  );

  const after = rt.getMembers().find((x) => x.id === m.id);
  assert.equal(after.status, "offline");
  assert.equal(after.workload.assignedWork, 0);
  assert.equal(after.workload.pendingWork, 0);
  assert.ok(Object.isFrozen(after));
});

test("Events: work assignment increases pending work and sets busy", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const m = rt.getMembers()[0];
  const prevPending = m.workload.pendingWork;

  rt.applyEvent(
    makeEvent({
      id: "evt_work_assigned_1",
      type: TEAM_EVENT_TYPES.TEAM_WORK_ASSIGNED,
      source: "test",
      payload: { memberId: m.id, assignedDelta: 2, pendingDelta: 3 },
    }),
  );

  const after = rt.getMembers().find((x) => x.id === m.id);
  assert.equal(after.status, "busy");
  assert.equal(after.workload.pendingWork, prevPending + 3);
});

test("Immutability: runtime state stays frozen after each event", () => {
  const rt = new TeamRuntime({ seed: buildDefaultTeamSeed });
  const m = rt.getMembers()[0];
  rt.applyEvent(
    makeEvent({
      id: "evt_work_complete_1",
      type: TEAM_EVENT_TYPES.TEAM_WORK_COMPLETED,
      source: "test",
      payload: { memberId: m.id, completedDelta: 1, pendingDelta: 1 },
    }),
  );
  assert.ok(Object.isFrozen(rt._state));
  assert.ok(Object.isFrozen(rt.getMembers()));
});

