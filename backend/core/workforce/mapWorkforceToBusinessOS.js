import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map workforce organization → existing Business OS specification fields.
 * Does not invent a parallel schema.
 */
export function mapWorkforceToBusinessOS(organization = {}) {
  const departments = (organization.departments ?? []).map((department) => ({
    departmentId: department.departmentId,
    label: department.label,
    purpose: department.purpose ?? "",
  }));

  const teamDefinitions = (organization.teams ?? []).map((team) => ({
    teamId: team.teamId,
    label: team.label,
    departmentId: team.departmentId,
    roleIds: (organization.humanRoles ?? [])
      .filter((role) => role.departmentId === team.departmentId)
      .map((role) => role.roleId),
  }));

  const roleDefinitions = (organization.humanRoles ?? []).map((role) => ({
    roleId: role.roleId,
    label: role.label,
    membershipRole: role.membershipRole,
    departmentId: role.departmentId,
    reportsTo: role.reportsTo,
    moduleVisibility: defaultModuleVisibility(role.membershipRole),
    permissions: defaultPermissions(role.membershipRole),
  }));

  const employeeDefinitions = (organization.aiEmployees ?? []).map((employee) => ({
    employeeId: employee.employeeId,
    label: employee.label,
    archetypeId: employee.archetypeId,
    purpose: employee.purpose,
    departmentId: employee.departmentId,
    teamId: employee.teamId,
    reportsTo: employee.reportsTo,
    capabilities: [],
    applicableModules: ["work", "team", "home"],
    acceptedWorkTypes: [],
    communicationPermissions: { customerFacingRequiresApproval: true },
    approvalRequirements: employee.approvals ?? ["human_approval"],
    responsibilities: employee.responsibilities ?? [],
    kpis: employee.kpis ?? [],
    knowledgeOwnership: employee.knowledgeOwnership ?? [],
    escalation: employee.escalation ?? null,
    delegation: employee.delegation ?? null,
  }));

  const teamAndAssignmentRules = {
    reportingLines: organization.reportingLines ?? [],
    coverageRules: organization.coverageRules ?? [],
    recurringReviews: organization.recurringReviews ?? [],
    escalationDefaults: {
      customerFacing: "manager",
      financial: "owner",
      aiOffline: "manager",
    },
  };

  const knowledgeRequirements = (organization.knowledgeOwnership ?? []).map((entry, index) => ({
    categoryId: entry.category ?? `knowledge_${index}`,
    ownerEmployeeId: entry.ownerId,
    required: true,
  }));

  return deepFreeze({
    departments,
    teamDefinitions,
    roleDefinitions,
    employeeDefinitions,
    teamAndAssignmentRules,
    knowledgeRequirements,
  });
}

function defaultModuleVisibility(membershipRole) {
  if (membershipRole === "OWNER") return ["home", "work", "people", "team", "knowledge", "performance", "settings"];
  if (membershipRole === "MANAGER") return ["home", "work", "people", "team", "knowledge", "performance"];
  return ["home", "work", "people", "knowledge"];
}

function defaultPermissions(membershipRole) {
  if (membershipRole === "OWNER") return ["business.manage", "team.manage", "team.invite", "work.view", "people.view", "performance.view"];
  if (membershipRole === "MANAGER") return ["team.manage", "work.view", "people.view", "performance.view"];
  return ["work.view", "people.view"];
}
