import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  BUSINESS_OS_MODULE_TYPES,
  BUSINESS_OS_SCHEMA_VERSION,
  BUSINESS_OS_SPECIFICATION_STATUSES,
} from "./BusinessOSSpecification.js";
import { listDashboardComponentTypes } from "./BusinessOSDashboardComponentRegistry.js";
import { listEmployeeArchetypeIds } from "./BusinessOSEmployeeArchetypes.js";

function issue(severity, code, message, path = null) {
  return deepFreeze({ severity, code, message, path });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// Architect can create declarative, owner-requested digital teammates. They
// are not new executable code paths: every custom teammate remains inside the
// standard workforce runtime and approval policy. Keep the namespace narrow so
// arbitrary archetype typos still fail validation.
function isOwnerDefinedEmployeeArchetype(archetypeId) {
  return /^owner_defined_[a-z0-9_-]+$/i.test(String(archetypeId ?? ""));
}

/**
 * Validates Business OS specifications against schema and registry references.
 * Does not mutate state.
 */
export function validateBusinessOSSpecification(specification, {
  capabilityRegistry = null,
  allowUnresolved = true,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!specification || typeof specification !== "object") {
    return deepFreeze({
      ok: false,
      errors: [issue("error", "spec_missing", "Specification is required.")],
      warnings: [],
    });
  }

  if (!specification.specificationId) {
    errors.push(issue("error", "specification_id_required", "specificationId is required.", "specificationId"));
  }
  if (!BUSINESS_OS_SPECIFICATION_STATUSES.includes(String(specification.status))) {
    errors.push(issue("error", "invalid_status", `Unsupported status: ${specification.status}`, "status"));
  }
  if (Number(specification.schemaVersion) !== BUSINESS_OS_SCHEMA_VERSION) {
    errors.push(issue(
      "error",
      "schema_version_mismatch",
      `Expected schemaVersion ${BUSINESS_OS_SCHEMA_VERSION}.`,
      "schemaVersion",
    ));
  }

  const profile = specification.businessProfile ?? {};
  if (!profile.businessName && !profile.name) {
    warnings.push(issue("warning", "business_name_missing", "Business name is recommended.", "businessProfile.businessName"));
  }

  const moduleIds = new Set();
  for (const [index, module] of asArray(specification.modules).entries()) {
    const path = `modules[${index}]`;
    if (!module?.moduleId) {
      errors.push(issue("error", "module_id_required", "moduleId is required.", path));
      continue;
    }
    if (moduleIds.has(module.moduleId)) {
      errors.push(issue("error", "duplicate_module_id", `Duplicate moduleId: ${module.moduleId}`, path));
    }
    moduleIds.add(module.moduleId);
    if (!module.label) {
      errors.push(issue("error", "module_label_required", "Module label is required.", `${path}.label`));
    }
    if (module.moduleType && !BUSINESS_OS_MODULE_TYPES.includes(String(module.moduleType))) {
      errors.push(issue("error", "invalid_module_type", `Unsupported moduleType: ${module.moduleType}`, `${path}.moduleType`));
    }
  }

  const primaryItems = asArray(specification.navigation?.primaryItems);
  for (const [index, item] of primaryItems.entries()) {
    const moduleId = item?.moduleId ?? item?.id;
    if (moduleId && moduleIds.size > 0 && !moduleIds.has(moduleId) && moduleId !== "home" && moduleId !== "more") {
      errors.push(issue(
        "error",
        "navigation_module_missing",
        `Primary navigation references unknown module: ${moduleId}`,
        `navigation.primaryItems[${index}]`,
      ));
    }
  }

  const maxPrimary = Number(specification.navigation?.maximumPrimaryItems ?? 8);
  if (
    primaryItems.filter((item) => item?.moduleId !== "more").length > maxPrimary
    && String(specification.navigation?.overflowBehavior ?? "more") !== "more"
  ) {
    warnings.push(issue(
      "warning",
      "primary_nav_overflow",
      `Primary navigation exceeds maximumPrimaryItems (${maxPrimary}). Overflow into More is required.`,
      "navigation.primaryItems",
    ));
  }

  const knownComponents = new Set(listDashboardComponentTypes());
  for (const [dIndex, dashboard] of asArray(specification.dashboardDefinitions).entries()) {
    for (const [wIndex, widget] of asArray(dashboard.widgets).entries()) {
      const type = widget?.componentType ?? widget?.type;
      if (!type || !knownComponents.has(String(type))) {
        errors.push(issue(
          "error",
          "unknown_dashboard_component",
          `Unknown dashboard component: ${type}`,
          `dashboardDefinitions[${dIndex}].widgets[${wIndex}]`,
        ));
      }
      if (!widget?.dataSource && !widget?.projectionId) {
        errors.push(issue(
          "error",
          "dashboard_data_source_required",
          "Dashboard widgets require a projection/dataSource.",
          `dashboardDefinitions[${dIndex}].widgets[${wIndex}]`,
        ));
      }
    }
  }

  const knownArchetypes = new Set(listEmployeeArchetypeIds());
  for (const [index, employee] of asArray(specification.employeeDefinitions).entries()) {
    if (!employee?.employeeId) {
      errors.push(issue("error", "employee_id_required", "employeeId is required.", `employeeDefinitions[${index}]`));
    }
    if (!employee?.label) {
      errors.push(issue("error", "employee_label_required", "Employee label is required.", `employeeDefinitions[${index}].label`));
    }
    const archetypeId = employee?.archetypeId;
    if (
      archetypeId
      && !knownArchetypes.has(String(archetypeId))
      && !isOwnerDefinedEmployeeArchetype(archetypeId)
    ) {
      errors.push(issue(
        "error",
        "unknown_employee_archetype",
        `Unknown employee archetype: ${archetypeId}`,
        `employeeDefinitions[${index}].archetypeId`,
      ));
    }
    for (const moduleId of asArray(employee?.applicableModules)) {
      if (moduleIds.size > 0 && !moduleIds.has(moduleId)) {
        warnings.push(issue(
          "warning",
          "employee_module_missing",
          `Employee references unknown module: ${moduleId}`,
          `employeeDefinitions[${index}].applicableModules`,
        ));
      }
    }
  }

  if (capabilityRegistry) {
    for (const [index, requirement] of asArray(specification.capabilityRequirements).entries()) {
      const capabilityId = requirement?.capabilityId ?? requirement?.id;
      if (!capabilityId) {
        errors.push(issue("error", "capability_id_required", "capabilityId is required.", `capabilityRequirements[${index}]`));
        continue;
      }
      const resolved = capabilityRegistry.resolve(capabilityId)
        ?? capabilityRegistry.resolvePackageFeature?.(capabilityId)
        ?? null;
      if (!resolved) {
        errors.push(issue(
          "error",
          "unknown_capability",
          `Unknown capability: ${capabilityId}`,
          `capabilityRequirements[${index}]`,
        ));
      } else if (resolved.availability === "prohibited") {
        errors.push(issue(
          "error",
          "prohibited_capability",
          `Capability is prohibited: ${capabilityId}`,
          `capabilityRequirements[${index}]`,
        ));
      }
    }
  }

  if (!allowUnresolved && asArray(specification.unresolvedRequirements).length > 0) {
    errors.push(issue(
      "error",
      "unresolved_requirements",
      "Unresolved requirements remain.",
      "unresolvedRequirements",
    ));
  }

  // Presentation terminology must never invent runtime class names.
  const terminologyBlob = JSON.stringify(specification.terminology ?? {});
  if (/PropertyRuntime|PatientRuntime|MatterRuntime|HockeyPlayerRuntime/i.test(terminologyBlob)) {
    errors.push(issue(
      "error",
      "vertical_runtime_forbidden",
      "Terminology must not introduce vertical-specific runtime classes.",
      "terminology",
    ));
  }

  return deepFreeze({
    ok: errors.length === 0,
    errors,
    warnings,
  });
}
