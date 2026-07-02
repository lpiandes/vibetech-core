import assert from "node:assert/strict";
import { test } from "node:test";

import { CapabilityRuntime } from "../runtime/CapabilityRuntime.js";
import { createCapability } from "../runtime/Capability.js";
import { CAPABILITY_EVENT_TYPES } from "../runtime/CapabilityEventTypes.js";

import { TeamRuntime } from "../../team/TeamRuntime.js";
import { createTeamMember } from "../../team/TeamMember.js";
import { createTeamDepartment } from "../../team/TeamDepartment.js";
import { createTeamRole } from "../../team/TeamRole.js";
import { createTeamMetrics } from "../../team/TeamMetrics.js";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { buildWorkItemForSeed } from "../../work/WorkBuilder.js";

import { CapabilityIntelligenceEngine } from "../intelligence/CapabilityIntelligenceEngine.js";
import { CapabilityViewAdapter } from "./CapabilityViewAdapter.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const COMPANY_ID = "co_1";

function makeTeamRuntime({ members } = {}) {
  const dept = createTeamDepartment({ id: "dept_1", name: "Dept", metadata: {} });
  const role = createTeamRole({ id: "role_1", name: "Role", metadata: {} });

  const built = (members ?? []).map((m) =>
    createTeamMember({
      id: m.id,
      name: m.name ?? m.id,
      memberType: m.memberType,
      departmentId: dept.id,
      roleId: role.id,
      status: m.status ?? "available",
      availability: m.availability ?? 80,
      capacity: m.capacity ?? 100,
      workload: { assignedWork: m.assignedWork ?? 0, completedWork: 0, pendingWork: m.pendingWork ?? 0 },
      skills: [],
      permissions: m.permissions ?? [],
      metrics: {
        assignedWork: m.assignedWork ?? 0,
        completedWork: 0,
        pendingWork: m.pendingWork ?? 0,
        capacity: m.capacity ?? 100,
        utilization: m.utilization ?? 10,
        availability: m.availability ?? 80,
      },
      metadata: {},
    }),
  );

  const cap = built.reduce((a, m) => a + Number(m?.metrics?.capacity ?? 0), 0) || 100;
  const metrics = createTeamMetrics({ assignedWork: 0, completedWork: 0, pendingWork: 0, capacity: cap, utilization: 0, availability: 100, metadata: {} });

  return new TeamRuntime({ seed: () => ({ members: built, departments: [dept], roles: [role], status: "available", metrics, recommendations: [] }) });
}

function makeWorkRuntime({ requiredCapabilities = [] } = {}) {
  const rt = new WorkRuntime({ nowISO: NOW_ISO });
  const workItem = buildWorkItemForSeed({
    nowISO: NOW_ISO,
    overrides: {
      id: "work_1",
      workType: "cap_work",
      status: "new",
      assignedTo: "unassigned",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      title: "Work",
      description: "Work",
      metadata: { requiredCapabilities },
      dueAt: null,
      requirements: [],
      relatedObjects: [],
    },
  });

  rt.applyEvent({
    id: "evt_work_item_created_1",
    timestampISO: NOW_ISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem },
  });
  return rt;
}

function makeCapabilityRuntime({ capabilities } = {}) {
  const rt = new CapabilityRuntime({ seed: null });
  for (const cap of capabilities ?? []) {
    rt.applyEvent({
      id: `evt_cap_${cap.id}`,
      timestampISO: NOW_ISO,
      type: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED,
      source: "test",
      payload: { capability: cap },
    });
  }
  return rt;
}

test("CapabilityViewAdapter: maps intelligence report into frozen CapabilityViewModel without mutating runtimes", () => {
  const capabilityRuntime = makeCapabilityRuntime({
    capabilities: [
      createCapability({
        id: "cap_a",
        name: "A",
        description: "d",
        category: "operations",
        level: 3,
        status: "active",
        requirements: [],
        providedBy: ["human"],
        requiredKnowledge: [],
        requiredConnectedSystems: [],
        metadata: {},
      }),
    ],
  });

  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_1", memberType: "human", status: "available", utilization: 10, capacity: 100, assignedWork: 0, pendingWork: 0, permissions: [] }],
  });

  const workRuntime = makeWorkRuntime({ requiredCapabilities: ["cap_a", "cap_missing"] });

  const beforeCap = JSON.stringify(capabilityRuntime._state);
  const beforeTeam = JSON.stringify(teamRuntime._state);
  const beforeWork = JSON.stringify(workRuntime._state);

  const intelligence = new CapabilityIntelligenceEngine({ nowISO: NOW_ISO }).generate({
    capabilityRuntime,
    teamRuntime,
    workRuntime,
    companyWorkspaceRuntime: null,
    companyId: COMPANY_ID,
    nowISO: NOW_ISO,
  });

  const adapter = new CapabilityViewAdapter({ nowISO: NOW_ISO });
  const vm = adapter.translate({ capabilityRuntime, capabilityIntelligenceReport: intelligence });

  assert.ok(Object.isFrozen(vm));
  assert.equal(vm.viewId, "vm_capabilities");
  assert.equal(vm.companyId, COMPANY_ID);
  assert.equal(vm.overallReadiness, intelligence.overallReadiness);

  assert.equal(vm.gaps.length, intelligence.gaps.length);
  assert.ok(vm.coverage.unmatchedWorkRequirements.length >= 0);

  // Runtime immutability check.
  assert.equal(JSON.stringify(capabilityRuntime._state), beforeCap);
  assert.equal(JSON.stringify(teamRuntime._state), beforeTeam);
  assert.equal(JSON.stringify(workRuntime._state), beforeWork);
});

