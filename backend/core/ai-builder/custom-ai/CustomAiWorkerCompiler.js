import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { compileSpecialtySurfacesOnSpecification } from "../specialty/SpecialtySurfaceCompiler.js";

export const CUSTOM_AI_CAPABILITY_ID = "custom_ai_work";
export const CUSTOM_AI_WORK_TYPE = "custom_ai_task";
export const CUSTOM_AI_PACKAGE_ID = "pkg.custom_ai_worker";

/**
 * Bind any custom / owner-added AI employee to the universal Custom AI Worker runtime.
 * Produces workTypes + capabilities + automation stub metadata. Outbound still approval-gated.
 */
export function compileCustomAiEmployee(employee = {}, { ownerAdded = false } = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "").trim();
  if (!employeeId) return null;

  const isOwner =
    ownerAdded
    || Boolean(employee.ownerAdded)
    || employee.readinessState === "owner_requested"
    || employeeId.startsWith("owner_emp_");

  const hasCustomWorker = Array.isArray(employee.capabilities)
    && employee.capabilities.map(String).includes(CUSTOM_AI_CAPABILITY_ID);

  if (!isOwner && !hasCustomWorker) {
    return deepFreeze({ ...employee, employeeId });
  }

  const label = String(employee.label ?? employee.name ?? employeeId);
  const purpose = String(employee.purpose ?? employee.role ?? `Owner-requested teammate: ${label}`);
  const capabilities = uniqueStrings([
    ...(Array.isArray(employee.capabilities) ? employee.capabilities : []),
    CUSTOM_AI_CAPABILITY_ID,
  ]);
  const acceptedWorkTypes = uniqueStrings([
    ...(Array.isArray(employee.acceptedWorkTypes) ? employee.acceptedWorkTypes : []),
    CUSTOM_AI_WORK_TYPE,
  ]);

  return deepFreeze({
    ...employee,
    employeeId,
    label,
    purpose,
    ownerAdded: true,
    capabilities,
    acceptedWorkTypes,
    applicableModules: uniqueStrings([
      ...(Array.isArray(employee.applicableModules) ? employee.applicableModules : []),
      "work",
      "digital_workforce",
    ]),
    communicationPermissions: {
      ...(employee.communicationPermissions ?? {}),
      customerFacingRequiresApproval: true,
    },
    approvalRequirements: uniqueStrings([
      ...(Array.isArray(employee.approvalRequirements) ? employee.approvalRequirements : []),
      "human_approval",
    ]),
    prohibitedActions: uniqueStrings([
      ...(Array.isArray(employee.prohibitedActions) ? employee.prohibitedActions : []),
      "autonomous_customer_send",
    ]),
    readinessState: employee.readinessState === "disabled" ? "disabled" : "custom_ai_ready",
    connectionDependencies: Array.isArray(employee.connectionDependencies)
      ? employee.connectionDependencies
      : [],
    automationDefinitions: [
      ...(Array.isArray(employee.automationDefinitions) ? employee.automationDefinitions : []),
      {
        automationId: `auto_custom_${employeeId}`,
        name: `${label} — run specialty job`,
        status: "ACTIVE",
        employeeId,
        trigger: { type: "manual", eventType: "CUSTOM_AI_JOB_REQUESTED" },
        actions: [
          {
            id: `act_create_${employeeId}`,
            actionType: "CREATE_WORK",
            requiresApproval: false,
            order: 1,
            parameters: {
              workType: CUSTOM_AI_WORK_TYPE,
              assignedTo: employeeId,
              title: `${label} job`,
              metadata: {
                customAi: true,
                employeeId,
                purpose,
              },
            },
          },
        ],
        metadata: { employeeId, customAi: true, packageId: CUSTOM_AI_PACKAGE_ID },
      },
    ],
  });
}

/**
 * Ensure custom_ai_work capability requirement exists on the BOS specification.
 */
export function ensureCustomAiCapabilityRequirement(specification = {}) {
  const requirements = Array.isArray(specification.capabilityRequirements)
    ? [...specification.capabilityRequirements]
    : [];
  if (!requirements.some((entry) => String(entry?.capabilityId ?? entry?.id) === CUSTOM_AI_CAPABILITY_ID)) {
    requirements.push({
      capabilityId: CUSTOM_AI_CAPABILITY_ID,
      label: "Custom AI Worker",
      required: false,
      packageId: CUSTOM_AI_PACKAGE_ID,
    });
  }

  const workDefinitions = Array.isArray(specification.workDefinitions)
    ? [...specification.workDefinitions]
    : [];
  if (!workDefinitions.some((entry) => String(entry?.workType) === CUSTOM_AI_WORK_TYPE)) {
    workDefinitions.push({
      workType: CUSTOM_AI_WORK_TYPE,
      label: "Custom AI task",
      description: "Specialty job executed by a custom AI teammate. Outbound messages still need approval.",
      stages: ["open", "in_progress", "completed"],
    });
  }

  return deepFreeze({
    ...specification,
    capabilityRequirements: requirements,
    workDefinitions,
  });
}

/**
 * Compile all custom/owner employees on a specification.
 */
export function compileCustomAiEmployeesOnSpecification(specification = {}) {
  if (!specification || typeof specification !== "object") return specification;
  const employees = (Array.isArray(specification.employeeDefinitions)
    ? specification.employeeDefinitions
    : []
  )
    .map((employee) => compileCustomAiEmployee(employee))
    .filter(Boolean);

  const hasCustom = employees.some((employee) =>
    Array.isArray(employee.capabilities) && employee.capabilities.includes(CUSTOM_AI_CAPABILITY_ID),
  );

  const next = {
    ...specification,
    employeeDefinitions: employees,
  };
  const withCapability = hasCustom ? ensureCustomAiCapabilityRequirement(next) : deepFreeze(next);
  return compileSpecialtySurfacesOnSpecification(withCapability, {
    businessId: specification.businessId ?? null,
  });
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(String).filter(Boolean))];
}
