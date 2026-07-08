import { TEAM_EVENT_TYPES } from "../../team/TeamEventTypes.js";
import { createTeamMember } from "../../team/TeamMember.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`installPackageEmployees: ${message}`);
}

function slugRoleId(role) {
  return `role_${String(role ?? "digital").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}`;
}

export function installPackageEmployees({
  employeeDefinitions,
  humanTeamMembers,
  teamRuntime,
  nowISO,
  installedEmployeeIds = [],
} = {}) {
  if (!teamRuntime || typeof teamRuntime.applyEvent !== "function") fail("teamRuntime required.");

  const defs = Array.isArray(employeeDefinitions) ? employeeDefinitions : [];
  const humans = Array.isArray(humanTeamMembers) ? humanTeamMembers : [];
  const installedIds = [...installedEmployeeIds];
  const timestampISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");

  for (const h of humans) {
    const id = String(h.id ?? "");
    const existingHuman = (teamRuntime.getMembers?.() ?? []).some((m) => String(m.id) === id);
    if (!id || existingHuman) continue;

    teamRuntime.applyEvent({
      id: `evt_team_human_${id}_${timestampISO}`,
      timestampISO,
      source: "industry_package_installer",
      type: TEAM_EVENT_TYPES.TEAM_MEMBER_CREATED,
      payload: {
        member: createTeamMember({
          id,
          name: String(h.name ?? id),
          memberType: "human",
          departmentId: "dept_operations",
          roleId: slugRoleId(h.role ?? "team_member"),
          status: "available",
          availability: 70,
          capacity: 70,
          workload: { assignedWork: 0, completedWork: 0, pendingWork: 0 },
          skills: [],
          permissions: ["employee"],
          metrics: { assignedWork: 0, completedWork: 0, pendingWork: 0, capacity: 70, utilization: 0, availability: 70 },
          metadata: deepFreeze({ derivedFrom: { industryPackage: true, role: h.role ?? null } }),
        }),
      },
    });
    installedIds.push(id);
  }

  for (const def of defs) {
    const id = String(def.id ?? "");
    if (!id) continue;
    const existingDigital = (teamRuntime.getMembers?.() ?? []).some((m) => String(m.id) === id);
    if (existingDigital) {
      if (!installedIds.includes(id)) installedIds.push(id);
      continue;
    }

    teamRuntime.applyEvent({
      id: `evt_team_digital_${id}_${timestampISO}`,
      timestampISO,
      source: "industry_package_installer",
      type: TEAM_EVENT_TYPES.TEAM_MEMBER_CREATED,
      payload: {
        member: createTeamMember({
          id,
          name: String(def.name ?? id),
          memberType: "digital_employee",
          departmentId: "dept_operations",
          roleId: slugRoleId(def.role ?? "digital_employee"),
          status: "offline",
          availability: 0,
          capacity: 60,
          workload: { assignedWork: 0, completedWork: 0, pendingWork: 0 },
          skills: Array.isArray(def.capabilities) ? def.capabilities.map(String) : [],
          permissions: ["employee"],
          metrics: { assignedWork: 0, completedWork: 0, pendingWork: 0, capacity: 60, utilization: 0, availability: 0 },
          metadata: deepFreeze({
            derivedFrom: { industryPackage: true, packageEmployeeId: id },
            knowledgeRequirements: Array.isArray(def.knowledgeRequirements) ? def.knowledgeRequirements : [],
            requiresApproval: Boolean(def.requiresApproval),
          }),
        }),
      },
    });
    installedIds.push(id);
  }

  return {
    employeeIds: installedIds,
    digitalEmployeeDefinitions: deepFreeze(defs),
  };
}
