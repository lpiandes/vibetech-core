import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/** Mirror of custom AI capability id — avoid circular import with CustomAiWorkerCompiler. */
const CUSTOM_AI_CAPABILITY_ID = "custom_ai_work";

export const MODULE_SURFACE_BLOCKS = Object.freeze([
  "overview",
  "work",
  "knowledge",
  "integrations",
]);

export const AI_SURFACE_BLOCKS = Object.freeze([
  "overview",
  "run_job",
  "work",
  "automations",
  "ask",
]);

export function specialtyAiModuleId(employeeId) {
  return `specialty_ai_${String(employeeId)}`;
}

export function buildSpecialtyHref(surfaceId, { businessId = null } = {}) {
  const id = encodeURIComponent(String(surfaceId));
  if (businessId) return `/b/${encodeURIComponent(String(businessId))}/specialty/${id}`;
  return `/specialty/${id}`;
}

export function isSpecialtySurfaceModuleId(moduleId) {
  const id = String(moduleId ?? "");
  return id.startsWith("owner_mod_")
    || id.startsWith("specialty_ai_")
    || id.startsWith("owner_emp_");
}

export function isCustomAiEmployee(employee = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "");
  const capabilities = Array.isArray(employee.capabilities) ? employee.capabilities.map(String) : [];
  return Boolean(
    employee.ownerAdded
    || employee.customAiWork
    || employee.surfaceKind === "ai_teammate"
    || employeeId.startsWith("owner_emp_")
    || capabilities.includes(CUSTOM_AI_CAPABILITY_ID)
    || employee.readinessState === "custom_ai_ready"
    || employee.readinessState === "owner_requested",
  );
}

export function compileSpecialtyModule(module = {}, { businessId = null } = {}) {
  const moduleId = String(module.moduleId ?? module.id ?? "").trim();
  if (!moduleId) return null;

  const ownerAdded = Boolean(
    module.ownerAdded
    || module.surfaceKind
    || isSpecialtySurfaceModuleId(moduleId),
  );
  if (!ownerAdded && !module.surfaceKind) {
    return deepFreeze({ ...module, moduleId });
  }

  const surfaceKind = String(module.surfaceKind ?? (moduleId.startsWith("specialty_ai_") ? "ai_teammate" : "module"));
  const blocks = Array.isArray(module.blocks) && module.blocks.length
    ? module.blocks.map(String)
    : (surfaceKind === "ai_teammate" ? [...AI_SURFACE_BLOCKS] : [...MODULE_SURFACE_BLOCKS]);

  const employeeId = module.employeeId
    ? String(module.employeeId)
    : (moduleId.startsWith("specialty_ai_") ? moduleId.slice("specialty_ai_".length) : null);
  // AI teammate nav/surfaces open on employeeId so Team redirects and nav share one active href.
  const surfaceId = surfaceKind === "ai_teammate" && employeeId ? employeeId : moduleId;
  const href = buildSpecialtyHref(surfaceId, { businessId });

  return deepFreeze({
    ...module,
    moduleId,
    label: String(module.label ?? moduleId),
    moduleType: module.moduleType ?? "operations",
    primaryNavigationEligible: module.primaryNavigationEligible !== false,
    navigationPriority: Number(module.navigationPriority ?? 40),
    ownerAdded: true,
    surfaceKind,
    blocks,
    href,
    specialtyHref: href,
    iconName: module.iconName ?? (surfaceKind === "ai_teammate" ? "users" : "folder"),
    employeeId: employeeId || null,
  });
}

export function compileSpecialtyEmployee(employee = {}, { businessId = null } = {}) {
  const employeeId = String(employee.employeeId ?? employee.id ?? "").trim();
  if (!employeeId || !isCustomAiEmployee(employee)) {
    return employee?.employeeId || employee?.id
      ? deepFreeze({ ...employee, employeeId: employeeId || String(employee.employeeId ?? employee.id) })
      : null;
  }

  const href = buildSpecialtyHref(employeeId, { businessId });
  return deepFreeze({
    ...employee,
    employeeId,
    ownerAdded: true,
    surfaceKind: "ai_teammate",
    blocks: Array.isArray(employee.blocks) && employee.blocks.length
      ? employee.blocks.map(String)
      : [...AI_SURFACE_BLOCKS],
    specialtyHref: href,
    specialtyModuleId: specialtyAiModuleId(employeeId),
  });
}

/**
 * Fold specialty surfaces onto modules + custom AI employees for nav + host pages.
 */
export function compileSpecialtySurfacesOnSpecification(specification = {}, { businessId = null } = {}) {
  if (!specification || typeof specification !== "object") return specification;

  const employees = (Array.isArray(specification.employeeDefinitions)
    ? specification.employeeDefinitions
    : []
  )
    .map((employee) => compileSpecialtyEmployee(employee, { businessId }))
    .filter(Boolean);

  let modules = (Array.isArray(specification.modules) ? specification.modules : [])
    .map((module) => compileSpecialtyModule(module, { businessId }))
    .filter(Boolean);

  for (const employee of employees) {
    if (!isCustomAiEmployee(employee)) continue;
    const moduleId = specialtyAiModuleId(employee.employeeId);
    if (modules.some((module) => String(module.moduleId) === moduleId)) {
      modules = modules.map((module) => {
        if (String(module.moduleId) !== moduleId) return module;
        return compileSpecialtyModule({
          ...module,
          label: employee.label ?? employee.name ?? module.label,
          employeeId: employee.employeeId,
          surfaceKind: "ai_teammate",
          blocks: employee.blocks ?? AI_SURFACE_BLOCKS,
          purpose: employee.purpose,
        }, { businessId });
      });
      continue;
    }
    modules.push(compileSpecialtyModule({
      moduleId,
      label: String(employee.label ?? employee.name ?? employee.employeeId),
      moduleType: "operations",
      primaryNavigationEligible: true,
      navigationPriority: 35 + modules.length,
      ownerAdded: true,
      surfaceKind: "ai_teammate",
      blocks: employee.blocks ?? AI_SURFACE_BLOCKS,
      employeeId: employee.employeeId,
      purpose: employee.purpose,
      iconName: "users",
    }, { businessId }));
  }

  return deepFreeze({
    ...specification,
    modules,
    employeeDefinitions: employees,
  });
}
