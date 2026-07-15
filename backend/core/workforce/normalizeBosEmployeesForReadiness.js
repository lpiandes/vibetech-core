import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Map Business OS / install configuration employees into the shape
 * DigitalEmployeeReadinessEngine expects (id, name, capabilities, …).
 */
export function normalizeBosEmployeeForReadiness(employee = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "").trim();
  if (!employeeId) return null;

  const label = String(employee.label ?? employee.name ?? employeeId);
  const purpose = String(employee.purpose ?? employee.role ?? "");
  const ownerAdded = Boolean(
    employee.ownerAdded
    || employee.readinessState === "owner_requested"
    || employeeId.startsWith("owner_emp_"),
  );

  const capabilities = Array.isArray(employee.capabilities)
    ? employee.capabilities.map(String).filter(Boolean)
    : (ownerAdded ? ["custom_ai_work"] : []);

  const hasCustomAiWork = capabilities.includes("custom_ai_work")
    || employee.readinessState === "custom_ai_ready";

  const connectionDependencies = Array.isArray(employee.connectionDependencies)
    ? employee.connectionDependencies.map(String).filter(Boolean)
    : [];

  return deepFreeze({
    id: employeeId,
    employeeId,
    name: label,
    role: purpose || String(employee.archetypeId ?? "teammate"),
    purpose,
    archetypeId: employee.archetypeId ?? null,
    capabilities: hasCustomAiWork && !capabilities.includes("custom_ai_work")
      ? [...capabilities, "custom_ai_work"]
      : capabilities,
    knowledgeRequirements: Array.isArray(employee.knowledgeRequirements)
      ? employee.knowledgeRequirements.map(String)
      : [],
    connectionDependencies,
    integrationCapabilities: Array.isArray(employee.integrationCapabilities)
      ? employee.integrationCapabilities.map(String)
      : [],
    // Outbound approval is a platform gate — does not block internal READY status.
    requiresApproval: false,
    ownerAdded: ownerAdded || hasCustomAiWork,
    customAiWork: hasCustomAiWork || ownerAdded,
    readinessState: employee.readinessState
      ?? (hasCustomAiWork || ownerAdded ? "custom_ai_ready" : null),
    applicableModules: Array.isArray(employee.applicableModules) ? employee.applicableModules : [],
    responsibilities: Array.isArray(employee.responsibilities) ? employee.responsibilities : [],
    description: purpose || null,
  });
}

/**
 * Prefer installed BOS employees when present; otherwise keep package employees.
 * Dedupes by employee id (BOS wins on conflict).
 */
export function resolveEmployeeDefinitionsForReadiness({
  bosEmployees = [],
  packageEmployees = [],
  installationEmployees = [],
} = {}) {
  const bosNormalized = (Array.isArray(bosEmployees) ? bosEmployees : [])
    .map((entry) => normalizeBosEmployeeForReadiness(entry))
    .filter(Boolean);

  if (bosNormalized.length > 0) {
    return deepFreeze(bosNormalized);
  }

  const packageNormalized = (Array.isArray(packageEmployees) ? packageEmployees : []).map((entry) => {
    if (entry?.id && entry?.name) return entry;
    return normalizeBosEmployeeForReadiness(entry) ?? entry;
  });

  const installNormalized = (Array.isArray(installationEmployees) ? installationEmployees : [])
    .map((entry) => normalizeBosEmployeeForReadiness(entry))
    .filter(Boolean);

  if (packageNormalized.length > 0) return deepFreeze(packageNormalized);
  return deepFreeze(installNormalized);
}
