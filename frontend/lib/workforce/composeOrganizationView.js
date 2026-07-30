/**
 * Pure Organization workspace projection — no React.
 * Prefers installed Business OS / workforce mapping; falls back to live team members.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function composeOrganizationView({
  configuration = null,
  workforceOrganization = null,
  platformMembers = [],
  digitalEmployees = [],
} = {}) {
  const org = workforceOrganization
    ?? configuration?.organization
    ?? null;

  const departments = asArray(org?.departments?.length ? org.departments : configuration?.teamDefinitions)
    .map((entry) => ({
      id: String(entry.departmentId ?? entry.teamId ?? entry.id),
      label: String(entry.label ?? "Department"),
      purpose: String(entry.purpose ?? ""),
      kind: entry.departmentId ? "department" : "team",
    }));

  const teams = asArray(org?.teams ?? configuration?.teamDefinitions).map((entry) => ({
    id: String(entry.teamId ?? entry.id),
    label: String(entry.label ?? "Team"),
    departmentId: entry.departmentId ? String(entry.departmentId) : null,
  }));

  const humanRoles = asArray(org?.humanRoles ?? configuration?.roleDefinitions).map((entry) => ({
    id: String(entry.roleId ?? entry.id),
    label: String(entry.label ?? "Role"),
    membershipRole: String(entry.membershipRole ?? "EMPLOYEE"),
    departmentId: entry.departmentId ? String(entry.departmentId) : null,
    reportsTo: entry.reportsTo ? String(entry.reportsTo) : null,
  }));

  // Best-effort department assignment for real staff: no membership-level
  // department field exists yet, so infer from the first role recipe that
  // shares this person's membership role (accurate before real employees
  // are installed, when humanRoles come from the workforce recommendation;
  // otherwise falls back to "unassigned" rather than guessing).
  const departmentIdByMembershipRole = new Map();
  for (const role of humanRoles) {
    if (role.departmentId && !departmentIdByMembershipRole.has(role.membershipRole)) {
      departmentIdByMembershipRole.set(role.membershipRole, role.departmentId);
    }
  }

  const humans = asArray(platformMembers).map((member) => ({
    id: String(member.id),
    label: String(member.name ?? member.email ?? "Teammate"),
    detail: String(member.roleLabel ?? member.email ?? ""),
    kind: "human",
    email: member.email ?? null,
    departmentId: departmentIdByMembershipRole.get(String(member.membershipRole ?? "").toUpperCase()) ?? null,
  }));

  const aiEmployees = asArray(
    org?.aiEmployees?.length
      ? org.aiEmployees
      : (configuration?.employees ?? digitalEmployees),
  ).map((entry) => ({
    id: String(entry.employeeId ?? entry.id ?? entry.name),
    label: String(entry.label ?? entry.name ?? "AI employee"),
    detail: String(entry.purpose ?? entry.responsibility ?? entry.role ?? ""),
    kind: "ai_employee",
    archetypeId: entry.archetypeId ?? null,
    departmentId: entry.departmentId ?? null,
    reportsTo: entry.reportsTo ?? null,
    responsibilities: asArray(entry.responsibilities),
    approvals: asArray(entry.approvals ?? entry.approvalRequirements),
    kpis: asArray(entry.kpis),
    knowledgeOwnership: asArray(entry.knowledgeOwnership),
    escalation: entry.escalation ?? null,
  }));

  const reportingLines = asArray(org?.reportingLines ?? configuration?.teamAndAssignmentRules?.reportingLines);
  const coverageRules = asArray(org?.coverageRules ?? configuration?.teamAndAssignmentRules?.coverageRules);
  const responsibilities = asArray(org?.responsibilities);
  const approvals = asArray(org?.approvals);
  const kpis = asArray(org?.kpis);
  const knowledgeOwnership = asArray(org?.knowledgeOwnership);

  return {
    hasOrganization: Boolean(departments.length || teams.length || aiEmployees.length || humans.length),
    departments,
    teams,
    humanRoles,
    humans,
    aiEmployees,
    reportingLines,
    coverageRules,
    responsibilities,
    approvals,
    kpis,
    knowledgeOwnership,
    metrics: [
      { id: "departments", label: "Departments", value: departments.length },
      { id: "teams", label: "Teams", value: teams.length },
      { id: "humans", label: "Humans", value: humans.length },
      { id: "ai", label: "AI employees", value: aiEmployees.length },
    ],
  };
}
