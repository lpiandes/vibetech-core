import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BUSINESS_OS_MODULE_TYPES } from "./BusinessOSSpecification.js";

function fail(message) {
  throw new Error(`BusinessModuleDefinition: ${message}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Universal Business Module Definition.
 * Modules are workspaces (Properties, Teams, Patients) — not individual employees or tasks.
 */
export function createBusinessModuleDefinition({
  moduleId,
  label,
  description = "",
  moduleType = "records",
  capabilityIds = [],
  subjectTypes = [],
  requestTypes = [],
  workTypes = [],
  dashboardSections = [],
  primaryActions = [],
  searchScopes = [],
  roleVisibility = [],
  navigationPriority = 100,
  primaryNavigationEligible = true,
  secondaryNavigationItems = [],
  routeCapability = null,
  emptyState = null,
  href = null,
  iconName = "folder",
  metadata = {},
} = {}) {
  if (!moduleId || typeof moduleId !== "string") fail("moduleId required string.");
  if (!label || typeof label !== "string") fail("label required string.");
  if (!BUSINESS_OS_MODULE_TYPES.includes(String(moduleType))) {
    fail(`unsupported moduleType: ${moduleType}`);
  }

  return deepFreeze({
    moduleId: String(moduleId),
    label: String(label),
    description: String(description ?? ""),
    moduleType: String(moduleType),
    capabilityIds: deepFreeze(asArray(capabilityIds).map(String)),
    subjectTypes: deepFreeze(asArray(subjectTypes).map(String)),
    requestTypes: deepFreeze(asArray(requestTypes).map(String)),
    workTypes: deepFreeze(asArray(workTypes).map(String)),
    dashboardSections: deepFreeze(asArray(dashboardSections)),
    primaryActions: deepFreeze(asArray(primaryActions).map(String)),
    searchScopes: deepFreeze(asArray(searchScopes).map(String)),
    roleVisibility: deepFreeze(asArray(roleVisibility).map(String)),
    navigationPriority: Number(navigationPriority ?? 100),
    primaryNavigationEligible: primaryNavigationEligible !== false,
    secondaryNavigationItems: deepFreeze(asArray(secondaryNavigationItems).map((item) => (
      item && typeof item === "object" ? deepFreeze({ ...item }) : item
    ))),
    routeCapability: routeCapability == null ? null : String(routeCapability),
    emptyState: emptyState == null ? null : String(emptyState),
    href: href == null ? null : String(href),
    iconName: String(iconName ?? "folder"),
    metadata: deepFreeze(metadata && typeof metadata === "object" ? { ...metadata } : {}),
  });
}
