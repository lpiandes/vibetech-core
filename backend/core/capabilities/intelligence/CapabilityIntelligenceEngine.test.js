import assert from "node:assert/strict";
import { test } from "node:test";

import { CapabilityIntelligenceEngine } from "./CapabilityIntelligenceEngine.js";

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
      workload: { assignedWork: m.assignedWork ?? 0, completedWork: 0, pendingWork: 0 },
      skills: [],
      permissions: m.permissions ?? [],
      metrics: {
        assignedWork: m.assignedWork ?? 0,
        completedWork: 0,
        pendingWork: 0,
        capacity: m.capacity ?? 100,
        utilization: m.utilization ?? 10,
        availability: m.availability ?? 80,
      },
      metadata: {},
    }),
  );

  const capacity = built.reduce((a, m) => a + Number(m.metrics.capacity ?? 0), 0) || 100;
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
      members: built,
      departments: [dept],
      roles: [role],
      status: "available",
      metrics,
      recommendations: [],
    }),
  });
}

function makeWorkRuntimeWithRequiredCapabilities({ workItemId = "work_1", workType = "cap_work", requiredCapabilities = [] } = {}) {
  const runtime = new WorkRuntime({ nowISO: NOW_ISO });
  const workItem = buildWorkItemForSeed({
    nowISO: NOW_ISO,
    overrides: {
      id: workItemId,
      workType,
      status: "new",
      assignedTo: "unassigned",
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      title: "Work",
      description: "Work",
      metadata: { requiredCapabilities },
      dueAt: null,
      relatedObjects: [],
      requirements: [],
    },
  });

  runtime.applyEvent({
    id: `evt_${workItemId}_created`,
    timestampISO: NOW_ISO,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem },
  });
  return runtime;
}

function makeCapabilityRuntime({ capabilities } = {}) {
  const runtime = new CapabilityRuntime({ seed: null });
  for (const cap of capabilities ?? []) {
    runtime.applyEvent({
      id: `evt_cap_reg_${cap.id}`,
      timestampISO: NOW_ISO,
      type: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED,
      source: "test",
      payload: { capability: cap },
    });
  }
  return runtime;
}

function makeCompanyWorkspaceRuntimeStub({ connectedSystems = [], knowledgeItems = [] } = {}) {
  return {
    getConnectedSystems: () => connectedSystems,
    getKnowledgeRepository: () => ({ items: knowledgeItems }),
  };
}

test("Report generation: coverage, gaps, risks, strengths, and recommendations are deterministic", () => {
  const capabilityRuntime = makeCapabilityRuntime({
    capabilities: [
      createCapability({
        id: "cap_diverse",
        name: "Diverse",
        description: "d",
        category: "operations",
        level: 3,
        status: "active",
        requirements: [],
        providedBy: ["human", "digital_employee"],
        requiredKnowledge: [],
        requiredConnectedSystems: [],
        metadata: {},
      }),
      createCapability({
        id: "cap_single",
        name: "Single",
        description: "d",
        category: "operations",
        level: 3,
        status: "active",
        requirements: [],
        providedBy: ["human"],
        requiredKnowledge: ["kn_1"],
        requiredConnectedSystems: ["cs_1"],
        metadata: {},
      }),
    ],
  });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_h_1", memberType: "human", status: "available", utilization: 90, assignedWork: 90 },
      { id: "tm_d_1", memberType: "digital_employee", status: "available", utilization: 10, assignedWork: 10 },
    ],
  });

  const workRuntime = makeWorkRuntimeWithRequiredCapabilities({
    workItemId: "work_1",
    workType: "cap_work",
    requiredCapabilities: ["cap_diverse", "cap_single", "cap_missing"],
  });

  const companyWorkspaceRuntime = makeCompanyWorkspaceRuntimeStub({
    connectedSystems: [], // missing cs_1
    knowledgeItems: [], // missing kn_1
  });

  const engine = new CapabilityIntelligenceEngine({ nowISO: NOW_ISO });
  const report = engine.generate({
    capabilityRuntime,
    teamRuntime,
    workRuntime,
    companyWorkspaceRuntime,
    companyId: COMPANY_ID,
    nowISO: NOW_ISO,
  });

  assert.ok(report.reportId.startsWith("report_cap_intel_"));
  assert.equal(report.companyId, COMPANY_ID);
  assert.equal(report.generatedAt, NOW_ISO);

  // Coverage should be 2/3 = 66.666... -> rounded in engine overallReadiness only; coverageScore is raw.
  assert.equal(report.coverage.requiredCapabilities.length, 3);
  assert.equal(report.coverage.coveredCapabilities.length, 2);
  assert.equal(report.coverage.coverageScore, (2 / 3) * 100);

  const gapIds = report.gaps.map((g) => g.capabilityId);
  assert.ok(gapIds.includes("cap_missing"));

  // Cap_single has single-provider dependency (only human) and also missing systems/knowledge.
  const riskTypes = report.risks.map((r) => r.type);
  assert.ok(riskTypes.includes("single_provider_dependency"));
  assert.ok(riskTypes.includes("missing_connected_system_requirement"));
  assert.ok(riskTypes.includes("missing_knowledge_requirement"));

  // Strength: cap_diverse should be covered and has two available provider types.
  const strengthCapIds = report.strengths.map((s) => s.capabilityId);
  assert.ok(strengthCapIds.includes("cap_diverse"));

  const recTypes = report.recommendations.map((r) => r.type);
  assert.ok(recTypes.includes("add_capability"));
  assert.ok(recTypes.includes("reduce_provider_dependency"));
  assert.ok(recTypes.includes("connect_system"));
  assert.ok(recTypes.includes("publish_required_knowledge"));

  // Immutability.
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.strengths));
  assert.ok(Object.isFrozen(report.gaps));
  assert.ok(Object.isFrozen(report.risks));
});

test("Runtime non-mutation: CapabilityRuntime, TeamRuntime, and WorkRuntime are unchanged", () => {
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
    members: [{ id: "tm_a", memberType: "human", status: "available", utilization: 10, assignedWork: 1 }],
  });

  const workRuntime = makeWorkRuntimeWithRequiredCapabilities({
    requiredCapabilities: ["cap_a"],
  });

  const beforeCap = JSON.stringify(capabilityRuntime._state);
  const beforeTeam = JSON.stringify(teamRuntime._state);
  const beforeWork = JSON.stringify(workRuntime._state);

  const engine = new CapabilityIntelligenceEngine({ nowISO: NOW_ISO });
  engine.generate({ capabilityRuntime, teamRuntime, workRuntime, companyWorkspaceRuntime: null, companyId: COMPANY_ID, nowISO: NOW_ISO });

  assert.equal(JSON.stringify(capabilityRuntime._state), beforeCap);
  assert.equal(JSON.stringify(teamRuntime._state), beforeTeam);
  assert.equal(JSON.stringify(workRuntime._state), beforeWork);
});

