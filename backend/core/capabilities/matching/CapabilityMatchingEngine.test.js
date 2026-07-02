import assert from "node:assert/strict";
import { test } from "node:test";

import { CapabilityRuntime } from "../runtime/CapabilityRuntime.js";
import { createCapability } from "../runtime/Capability.js";

import { CAPABILITY_EVENT_TYPES } from "../runtime/CapabilityEventTypes.js";

import { PlatformEventBuilder } from "../../events/PlatformEventBuilder.js";

import { buildWorkItemForSeed } from "../../work/WorkBuilder.js";
import { WorkRuntime } from "../../work/WorkRuntime.js";

import { TeamRuntime } from "../../team/TeamRuntime.js";
import { createTeamMember } from "../../team/TeamMember.js";
import { createTeamDepartment } from "../../team/TeamDepartment.js";
import { createTeamRole } from "../../team/TeamRole.js";
import { createTeamMetrics } from "../../team/TeamMetrics.js";

import { CapabilityMatchingEngine } from "./CapabilityMatchingEngine.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const GEN_AT = "2026-07-01T00:00:00.000Z";

function makeTeamRuntime({ members } = {}) {
  const dept = createTeamDepartment({ id: "dept_1", name: "Dept 1", metadata: {} });
  const role = createTeamRole({ id: "role_1", name: "Role 1", metadata: {} });

  const builtMembers = safeArray(members).map((m) => {
    return createTeamMember({
      id: m.id,
      name: m.name ?? m.id,
      memberType: m.memberType,
      departmentId: m.departmentId ?? dept.id,
      roleId: m.roleId ?? role.id,
      status: m.status ?? "available",
      availability: m.availability ?? 80,
      capacity: m.capacity ?? 100,
      workload: { assignedWork: m.assignedWork ?? 0, completedWork: 0, pendingWork: 0 },
      skills: [],
      permissions: [],
      metrics: {
        assignedWork: m.assignedWork ?? 0,
        completedWork: 0,
        pendingWork: 0,
        capacity: m.capacity ?? 100,
        utilization: m.utilization ?? 10,
        availability: m.availability ?? 80,
      },
      metadata: {},
    });
  });

  const capacityTotal = builtMembers.reduce((a, m) => a + Number(m?.metrics?.capacity ?? 0), 0) || 100;
  const metrics = createTeamMetrics({
    assignedWork: 0,
    completedWork: 0,
    pendingWork: 0,
    capacity: capacityTotal,
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

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function registerCapability({ capabilityRuntime, capability }) {
  capabilityRuntime.applyEvent({
    id: `evt_register_${capability.id}`,
    timestampISO: GEN_AT,
    type: CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED,
    source: "test",
    payload: { capability },
  });
}

function makeWorkItem({ id = "work_1", workType = "worktype_x", requirements = [], metadata = {} } = {}) {
  return buildWorkItemForSeed({
    nowISO: NOW_ISO,
    overrides: {
      id,
      workType,
      requirements,
      metadata,
    },
  });
}

function cloneState(runtime) {
  return JSON.stringify(runtime._state ?? runtime);
}

test("exact capability match: required capability covered by best provider", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const cap = createCapability({
    id: "cap_exact",
    name: "Exact Capability",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: cap });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_1", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 },
    ],
  });

  const workItem = makeWorkItem({ id: "wi_1", workType: "worktype_x", metadata: { requiredCapabilities: ["cap_exact"] } });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.equal(res.bestMatch.providerId, "tm_1");
  assert.ok(res.bestMatch.capabilityIds.includes("cap_exact"));
  assert.deepEqual(res.requiredCapabilities, ["cap_exact"]);
  assert.ok(res.bestMatch.score >= 90);
});

test("category match: required capabilities derived from workType category", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });

  const capHuman = createCapability({
    id: "cap_cat_human",
    name: "Category Capability Human",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_cat_digital",
    name: "Category Capability Digital",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_human", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 }],
  });

  // No metadata.requiredCapabilities => fallback to category match on workType.
  const workItem = makeWorkItem({ id: "wi_2", workType: "operations", metadata: {} });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.equal(res.requiredCapabilities.length, 2);
  assert.equal(res.bestMatch.providerId, "tm_human");
  assert.deepEqual(res.bestMatch.capabilityIds, ["cap_cat_human"]);
  assert.ok(res.bestMatch.score < 100);
});

test("no match: unknown required capability yields no matches and unmatchedRequirements includes it", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_human", memberType: "human", status: "available", availability: 90, utilization: 10 }],
  });

  const workItem = makeWorkItem({ id: "wi_3", workType: "operations", metadata: { requiredCapabilities: ["cap_missing"] } });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.equal(res.bestMatch, null);
  assert.equal(res.matches.length, 0);
  assert.deepEqual(res.unmatchedRequirements, ["cap_missing"]);
});

test("bestMatch selection: provider availability picks highest scoring match", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });

  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_digital_only",
    name: "Digital only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_busy", memberType: "human", status: "busy", availability: 10, utilization: 10, capacity: 100, assignedWork: 10 },
      { id: "tm_available", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 },
    ],
  });

  // Two required capabilities; human provider covers only cap_human_only, so availability affects score.
  const workItem = makeWorkItem({
    id: "wi_4",
    workType: "worktype_x",
    metadata: { requiredCapabilities: ["cap_human_only", "cap_digital_only"] },
  });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.equal(res.bestMatch.providerId, "tm_available");
  assert.ok(res.bestMatch.score > res.matches.find((m) => m.providerId === "tm_busy").score);
});

test("score ordering: matches are sorted by score desc then providerId asc", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });

  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_digital_only",
    name: "Digital only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_a", memberType: "human", status: "available", availability: 70, utilization: 10, capacity: 100, assignedWork: 10 },
      { id: "tm_b", memberType: "human", status: "busy", availability: 10, utilization: 10, capacity: 100, assignedWork: 10 },
    ],
  });

  const workItem = makeWorkItem({
    id: "wi_5",
    workType: "worktype_x",
    metadata: { requiredCapabilities: ["cap_human_only", "cap_digital_only"] },
  });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.equal(res.matches.length, 2);
  assert.equal(res.matches[0].providerId, "tm_a");
  assert.equal(res.matches[1].providerId, "tm_b");
  assert.ok(res.matches[0].score >= res.matches[1].score);
});

test("unmatched requirements: required capability not covered by any match appears in unmatchedRequirements", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const capHuman = createCapability({
    id: "cap_h1",
    name: "Human cap",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_d1",
    name: "Digital cap",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_h", memberType: "human", status: "available", availability: 90, utilization: 10 }],
  });

  const workItem = makeWorkItem({
    id: "wi_6",
    workType: "worktype_x",
    metadata: { requiredCapabilities: ["cap_h1", "cap_d1"] },
  });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.deepEqual(res.unmatchedRequirements, ["cap_d1"]);
});

test("provider availability penalty: busy provider scores lower than available provider", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_digital_only",
    name: "Digital only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_busy", memberType: "human", status: "busy", availability: 10, utilization: 10, capacity: 100, assignedWork: 10 },
      { id: "tm_available", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 },
    ],
  });

  const workItem = makeWorkItem({
    id: "wi_7",
    workType: "worktype_x",
    metadata: { requiredCapabilities: ["cap_human_only", "cap_digital_only"] },
  });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  const busy = res.matches.find((m) => m.providerId === "tm_busy");
  const available = res.matches.find((m) => m.providerId === "tm_available");
  assert.ok(available.score > busy.score);
});

test("workload penalty: high utilization provider scores lower", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });

  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_digital_only",
    name: "Digital only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm_low", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 },
      { id: "tm_high", memberType: "human", status: "available", availability: 90, utilization: 80, capacity: 100, assignedWork: 80 },
    ],
  });

  const workItem = makeWorkItem({
    id: "wi_8",
    workType: "worktype_x",
    metadata: { requiredCapabilities: ["cap_human_only", "cap_digital_only"] },
  });

  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  const low = res.matches.find((m) => m.providerId === "tm_low");
  const high = res.matches.find((m) => m.providerId === "tm_high");
  assert.ok(low.score > high.score);
});

test("immutability: CapabilityMatchResult and nested matches are frozen", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });

  const teamRuntime = makeTeamRuntime({
    members: [{ id: "tm_h", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 }],
  });

  const workItem = makeWorkItem({ id: "wi_9", workType: "worktype_x", metadata: { requiredCapabilities: ["cap_human_only"] } });
  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  const res = engine.match({ workItem, capabilityRuntime, teamRuntime });

  assert.ok(Object.isFrozen(res));
  assert.ok(Object.isFrozen(res.requiredCapabilities));
  for (const m of res.matches) assert.ok(Object.isFrozen(m));
});

test("runtime non-mutation: engine does not modify CapabilityRuntime or TeamRuntime state", () => {
  const capabilityRuntime = new CapabilityRuntime({ seed: null });
  const capHuman = createCapability({
    id: "cap_human_only",
    name: "Human only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  const capDigital = createCapability({
    id: "cap_digital_only",
    name: "Digital only",
    description: "desc",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["digital_employee"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
  });
  registerCapability({ capabilityRuntime, capability: capHuman });
  registerCapability({ capabilityRuntime, capability: capDigital });

  const teamRuntime = makeTeamRuntime({
    members: [
      { id: "tm1", memberType: "human", status: "available", availability: 90, utilization: 10, capacity: 100, assignedWork: 10 },
      { id: "tm2", memberType: "human", status: "busy", availability: 10, utilization: 10, capacity: 100, assignedWork: 10 },
    ],
  });

  const beforeCap = cloneState(capabilityRuntime);
  const beforeTeam = cloneState(teamRuntime);

  const workItem = makeWorkItem({ id: "wi_10", workType: "worktype_x", metadata: { requiredCapabilities: ["cap_human_only", "cap_digital_only"] } });
  const engine = new CapabilityMatchingEngine({ nowISO: NOW_ISO });
  engine.match({ workItem, capabilityRuntime, teamRuntime });

  const afterCap = cloneState(capabilityRuntime);
  const afterTeam = cloneState(teamRuntime);
  assert.equal(afterCap, beforeCap);
  assert.equal(afterTeam, beforeTeam);
});

