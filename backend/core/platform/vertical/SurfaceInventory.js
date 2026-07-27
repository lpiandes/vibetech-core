/**
 * Inventory + quarantine map for Codex gap plan.
 * PM remains an installable package; sports/dental must never inherit PM surfaces by default.
 *
 * Disposition legend:
 * - keep: shared OS / valid for all verticals
 * - adapt: shared surface; copy/modules must be terminology-driven
 * - quarantine: PM-only until gate is true
 * - delete-later: footguns to neutralize now, remove after dependency check
 */

export const SURFACE_INVENTORY = Object.freeze([
  Object.freeze({
    id: "nav_properties",
    path: "frontend/components/workspace/canonicalBusinessNavigation.ts",
    disposition: "quarantine",
    note: "Subjects/Properties nav only when modules includes properties",
  }),
  Object.freeze({
    id: "default_mcbride_modules",
    path: "frontend/components/workspace/moduleDrivenNavigation.ts",
    disposition: "delete-later",
    note: "DEFAULT_MCBRIDE_MODULES must not inject properties when install is empty",
  }),
  Object.freeze({
    id: "route_properties",
    path: "frontend/app/b/[businessId]/properties",
    disposition: "quarantine",
    note: "Already redirects non-PM; keep gate",
  }),
  Object.freeze({
    id: "api_maintenance",
    path: "frontend/app/api/businesses/[businessId]/maintenance-requests",
    disposition: "quarantine",
    note: "PM maintenance API — gate by PM workspace",
  }),
  Object.freeze({
    id: "integration_pms",
    path: "frontend/components/connections/integrationDisplay.ts",
    disposition: "quarantine",
    note: "property_management_system listed only for PM workspaces",
  }),
  Object.freeze({
    id: "copy_property_interest",
    path: "frontend/components/people/PeopleDetailLayout.tsx",
    disposition: "adapt",
    note: "Replace hard-coded Property interest with terminology subject label",
  }),
  Object.freeze({
    id: "empty_business_home",
    path: "frontend/components/home/EmptyBusinessHome.tsx",
    disposition: "adapt",
    note: "Remove Resident & Prospect / PM software default copy",
  }),
  Object.freeze({
    id: "knowledge",
    path: "frontend/components/knowledge",
    disposition: "keep",
    note: "Universal OS pillar",
  }),
  Object.freeze({
    id: "work",
    path: "frontend/components/work",
    disposition: "keep",
    note: "Universal OS pillar",
  }),
  Object.freeze({
    id: "approvals_home",
    path: "frontend/components/operating/OperatingHomeExperience.tsx",
    disposition: "keep",
    note: "Approvals inbox — shared",
  }),
  Object.freeze({
    id: "pm_industry_package",
    path: "industries/property-management",
    disposition: "quarantine",
    note: "Do not delete; only activate for PM installs",
  }),
  Object.freeze({
    id: "operating_packs",
    path: "backend/core/ai-builder/OperatingPackRegistry.js",
    disposition: "keep",
    note: "dental_v1 + youth_sports_v1 configuration layer",
  }),
  Object.freeze({
    id: "drive_accounting_stubs",
    path: "backend/core/integrations/document-storage",
    disposition: "adapt",
    note: "Stubs — not proven live",
  }),
]);

export const PM_ONLY_MODULE_IDS = Object.freeze(["properties"]);
export const PM_ONLY_CONNECTION_IDS = Object.freeze(["property_management_system"]);
export const PM_INDUSTRY_PACKAGE_ID = "pkg_property_management";

/**
 * Single gate: is this workspace property-management?
 */
export function isPropertyManagementWorkspace({
  installedModuleIds = [],
  industryPackageId = null,
  industry = null,
  operatingPackId = null,
} = {}) {
  const modules = new Set(
    (Array.isArray(installedModuleIds) ? installedModuleIds : []).map((id) => String(id)),
  );
  if (modules.has("properties")) return true;
  if (String(industryPackageId ?? "") === PM_INDUSTRY_PACKAGE_ID) return true;
  const ind = String(industry ?? "").trim().toLowerCase();
  if (ind === "property_management" || ind === "property-management") return true;
  const pack = String(operatingPackId ?? "").trim().toLowerCase();
  if (pack.startsWith("property")) return true;
  return false;
}

export function shouldListConnection(connectionId, workspaceGate = {}) {
  const id = String(connectionId ?? "");
  if (PM_ONLY_CONNECTION_IDS.includes(id) && !isPropertyManagementWorkspace(workspaceGate)) {
    return false;
  }
  return true;
}

export function filterModulesForVertical(modules = [], workspaceGate = {}) {
  const list = Array.isArray(modules) ? modules : [];
  if (isPropertyManagementWorkspace(workspaceGate)) return list;
  return list.filter((mod) => {
    const id = String(mod?.moduleId ?? mod?.id ?? mod ?? "");
    return !PM_ONLY_MODULE_IDS.includes(id);
  });
}
