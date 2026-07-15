import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  compileCustomAiEmployee,
  compileCustomAiEmployeesOnSpecification,
} from "./custom-ai/CustomAiWorkerCompiler.js";
import { compileSpecialtySurfacesOnSpecification } from "./specialty/SpecialtySurfaceCompiler.js";

/**
 * Fold owner plan edits (appearance.planAdditions + hidden overrides) into the
 * installable Business OS specification before dry-run / install.
 */
export function applyPlanAdditionsToSpecification(specification, session = null) {
  if (!specification || typeof specification !== "object") return specification;

  const appearance = session?.appearance ?? {};
  const planAdditions = appearance.planAdditions ?? { modules: [], employees: [] };
  const hiddenModules = appearance.navigationOverrides?.hidden ?? {};
  const hiddenEmployees = appearance.employeeOverrides?.hidden ?? {};
  const moduleLabels = appearance.navigationOverrides?.labels ?? {};
  const employeeLabels = appearance.employeeOverrides?.labels ?? {};
  const employeePurposes = appearance.employeeOverrides?.purposes ?? {};

  const addedModules = Array.isArray(planAdditions.modules) ? planAdditions.modules : [];
  const addedEmployees = Array.isArray(planAdditions.employees) ? planAdditions.employees : [];

  const modules = [
    ...(Array.isArray(specification.modules) ? specification.modules : [])
      .filter((module) => module?.moduleId && !hiddenModules[module.moduleId])
      .map((module) => ({
        ...module,
        label: moduleLabels[module.moduleId] ?? module.label,
      })),
  ];

  for (const entry of addedModules) {
    const moduleId = String(entry?.id ?? "").trim();
    if (!moduleId || hiddenModules[moduleId]) continue;
    if (modules.some((module) => String(module.moduleId) === moduleId)) continue;
    modules.push({
      moduleId,
      label: String(entry.label ?? moduleId),
      moduleType: "operations",
      primaryNavigationEligible: true,
      navigationPriority: modules.length + 1,
      href: null,
      ownerAdded: true,
      surfaceKind: "module",
    });
  }

  const employeeDefinitions = [
    ...(Array.isArray(specification.employeeDefinitions) ? specification.employeeDefinitions : [])
      .filter((employee) => employee?.employeeId && !hiddenEmployees[employee.employeeId])
      .map((employee) => ({
        ...employee,
        label: employeeLabels[employee.employeeId] ?? employee.label,
        purpose: employeePurposes[employee.employeeId] ?? employee.purpose,
      })),
  ];

  for (const entry of addedEmployees) {
    const employeeId = String(entry?.id ?? "").trim();
    if (!employeeId || hiddenEmployees[employeeId]) continue;
    if (employeeDefinitions.some((employee) => String(employee.employeeId) === employeeId)) continue;
    const label = String(entry.label ?? employeeId);
    employeeDefinitions.push(compileCustomAiEmployee({
      employeeId,
      label,
      archetypeId: inferOwnerAddedArchetype(label, entry.purpose),
      purpose: String(entry.purpose ?? `Owner-requested teammate: ${label}`),
      ownerAdded: true,
      readinessState: "owner_requested",
    }, { ownerAdded: true }));
  }

  // Rewrite pkg.* capability IDs to platform IDs when present (install registry compatibility).
  const capabilityRequirements = (Array.isArray(specification.capabilityRequirements)
    ? specification.capabilityRequirements
    : []
  ).map((requirement) => {
    const capabilityId = String(requirement?.capabilityId ?? requirement?.id ?? "");
    const mapped = PACKAGE_TO_PLATFORM[capabilityId];
    if (!mapped) return requirement;
    return { ...requirement, capabilityId: mapped };
  });

  const withWorkers = compileCustomAiEmployeesOnSpecification({
    ...specification,
    modules,
    employeeDefinitions,
    capabilityRequirements,
  });
  const businessId = session?.businessId
    ?? specification?.businessId
    ?? null;
  return compileSpecialtySurfacesOnSpecification(withWorkers, { businessId });
}

const PACKAGE_TO_PLATFORM = Object.freeze({
  "pkg.scheduling": "scheduling",
  "pkg.calendar_sync": "scheduling",
  "pkg.sms_messaging": "sms_messaging",
  "pkg.phone_voice": "missed_call_automation",
  "pkg.facebook_leads": "meta_lead_ads",
  "pkg.weekly_newsletter": "campaign_preparation",
  "pkg.fundraising": "campaign_preparation",
  "pkg.inquiry_reply_drafts": "communications_inbox",
  "pkg.autonomous_customer_email": "autonomous_customer_send",
  "pkg.custom_ai_worker": "custom_ai_work",
});

function inferOwnerAddedArchetype(label = "", purpose = "") {
  const text = `${label} ${purpose}`.toLowerCase();
  if (/\b(schedule|scheduler|appointment)\b/.test(text)) return "scheduler";
  if (/\b(campaign|newsletter)\b/.test(text)) return "campaign_coordinator";
  if (/\b(intake|lead)\b/.test(text)) return "intake_specialist";
  if (/\b(call|caller|phone)\b/.test(text)) return "ai_caller";
  if (/\b(knowledge|document)\b/.test(text)) return "document_specialist";
  if (/\b(practice|workout|training|coach|plan)\b/.test(text)) return "operations_coordinator";
  return "operations_coordinator";
}
