import { createTeamDepartment } from "./TeamDepartment.js";
import { createTeamRole } from "./TeamRole.js";
import { createTeamMember } from "./TeamMember.js";
import { createTeamMetrics } from "./TeamMetrics.js";
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function clampInt(n, min, max) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  const c = Math.max(min, Math.min(max, Math.round(v)));
  return c;
}

function buildSeedDepartments() {
  const deps = [
    { id: "dept_executive", name: "Executive", metadata: { seeded: true } },
    { id: "dept_support", name: "Support", metadata: { seeded: true } },
    { id: "dept_sales", name: "Sales", metadata: { seeded: true } },
    { id: "dept_operations", name: "Operations", metadata: { seeded: true } },
    { id: "dept_legal", name: "Legal", metadata: { seeded: true } },
    { id: "dept_it", name: "IT", metadata: { seeded: true } },
    { id: "dept_hr", name: "HR", metadata: { seeded: true } },
  ];
  return deps.map((d) => createTeamDepartment(d));
}

function buildSeedRoles() {
  const roles = [
    { id: "role_ceo", name: "Chief Executive Officer" },
    { id: "role_office_manager", name: "Office Manager" },
    { id: "role_support_lead", name: "Support Lead" },
    { id: "role_digital_intake", name: "Digital Intake Specialist" },
    { id: "role_digital_communications", name: "Digital Communications Specialist" },
    { id: "role_digital_operations", name: "Digital Operations Specialist" },
    { id: "role_project_manager", name: "Project Manager" },
    { id: "role_it_admin", name: "IT Administrator" },
  ];
  return roles.map((r) => createTeamRole(r));
}

function buildSeedMembers() {
  // These are deterministic defaults. They are industry-agnostic.
  const members = [
    {
      id: "tm_ceo",
      name: "CEO",
      memberType: "human",
      departmentId: "dept_executive",
      roleId: "role_ceo",
      status: "available",
      availability: 70,
      capacity: 70,
      workload: { assignedWork: 2, completedWork: 5, pendingWork: 1 },
      skills: ["strategic decisioning", "governance"],
      permissions: ["manager"],
      metrics: { assignedWork: 2, completedWork: 5, pendingWork: 1, capacity: 70, utilization: 3, availability: 70 },
      metadata: deepFreeze({ seeded: true }),
    },
    {
      id: "tm_office_manager",
      name: "Office Manager",
      memberType: "human",
      departmentId: "dept_operations",
      roleId: "role_office_manager",
      status: "busy",
      availability: 50,
      capacity: 55,
      workload: { assignedWork: 6, completedWork: 8, pendingWork: 3 },
      skills: ["coordination", "triage"],
      permissions: ["manager"],
      metrics: { assignedWork: 6, completedWork: 8, pendingWork: 3, capacity: 55, utilization: 11, availability: 50 },
      metadata: deepFreeze({ seeded: true }),
    },
    {
      id: "tm_support_lead",
      name: "Support Lead",
      memberType: "human",
      departmentId: "dept_support",
      roleId: "role_support_lead",
      status: "available",
      availability: 60,
      capacity: 60,
      workload: { assignedWork: 3, completedWork: 7, pendingWork: 0 },
      skills: ["customer support", "issue resolution"],
      permissions: ["employee"],
      metrics: { assignedWork: 3, completedWork: 7, pendingWork: 0, capacity: 60, utilization: 5, availability: 60 },
      metadata: deepFreeze({ seeded: true }),
    },
    {
      id: "tm_digital_intake",
      name: "Digital Intake Employee",
      memberType: "digital_employee",
      departmentId: "dept_it",
      roleId: "role_digital_intake",
      status: "busy",
      availability: 65,
      capacity: 65,
      workload: { assignedWork: 7, completedWork: 12, pendingWork: 2 },
      skills: ["intake processing", "triage"],
      permissions: ["employee"],
      metrics: { assignedWork: 7, completedWork: 12, pendingWork: 2, capacity: 65, utilization: 11, availability: 65 },
      metadata: deepFreeze({ seeded: true }),
    },
    {
      id: "tm_digital_communications",
      name: "Digital Communications Employee",
      memberType: "digital_employee",
      departmentId: "dept_operations",
      roleId: "role_digital_communications",
      status: "available",
      availability: 75,
      capacity: 75,
      workload: { assignedWork: 4, completedWork: 14, pendingWork: 0 },
      skills: ["message drafting", "governed communication"],
      permissions: ["employee"],
      metrics: { assignedWork: 4, completedWork: 14, pendingWork: 0, capacity: 75, utilization: 5, availability: 75 },
      metadata: deepFreeze({ seeded: true }),
    },
    {
      id: "tm_digital_operations",
      name: "Digital Operations Employee",
      memberType: "digital_employee",
      departmentId: "dept_operations",
      roleId: "role_digital_operations",
      status: "away",
      availability: 40,
      capacity: 50,
      workload: { assignedWork: 1, completedWork: 6, pendingWork: 4 },
      skills: ["workflow orchestration", "operational readiness"],
      permissions: ["employee"],
      metrics: { assignedWork: 1, completedWork: 6, pendingWork: 4, capacity: 50, utilization: 2, availability: 40 },
      metadata: deepFreeze({ seeded: true }),
    },
  ];

  return members.map((m) => createTeamMember(m));
}

export function buildDefaultTeamSeed() {
  const departments = buildSeedDepartments();
  const roles = buildSeedRoles();
  const members = buildSeedMembers();

  const totals = {
    assignedWork: members.reduce((a, m) => a + Number(m?.metrics?.assignedWork ?? 0), 0),
    completedWork: members.reduce((a, m) => a + Number(m?.metrics?.completedWork ?? 0), 0),
    pendingWork: members.reduce((a, m) => a + Number(m?.metrics?.pendingWork ?? 0), 0),
    capacity: members.reduce((a, m) => a + Number(m?.metrics?.capacity ?? 0), 0),
  };
  const utilization = totals.capacity > 0 ? (totals.assignedWork / totals.capacity) * 100 : 0;
  const availability = Math.max(0, Math.min(100, 100 - utilization));

  const metrics = createTeamMetrics({
    ...totals,
    utilization,
    availability,
  });

  return deepFreeze({
    members,
    departments,
    roles,
    status: "available",
    metrics,
    recommendations: [],
  });
}

