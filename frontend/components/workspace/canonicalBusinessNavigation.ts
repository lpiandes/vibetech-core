/**
 * Canonical primary navigation for `/b/[businessId]/**`.
 * Secondary destinations (Mission Control, For You, Performance, Engagement)
 * map into Home / Needs Attention / People without competing in the main nav.
 */

import { filterCanonicalNavForPurchasedPackages } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { resolveRoleAccess as resolveRoleAccessRaw } from "../../../backend/core/business-os/BusinessOSRoleAccess.js";

const resolveRoleAccess = resolveRoleAccessRaw as (input: Record<string, unknown>) => {
  deniedModuleIds: string[];
};

export type CanonicalNavItem = {
  id: string;
  label: string;
  href: string;
  iconName: string;
  permission: string | null;
  /** Badge source key — shell may overlay live counts */
  badgeKey?: "needsAttention" | null;
};

const CANONICAL_ORDER: Array<{
  id: string;
  label: string;
  path: string;
  iconName: string;
  permission: string | null;
  badgeKey?: "needsAttention";
}> = [
  { id: "home", label: "Home", path: "home", iconName: "home", permission: null },
  {
    id: "needs_attention",
    label: "Needs Attention",
    path: "intelligence",
    iconName: "alert-circle",
    permission: null,
    badgeKey: "needsAttention",
  },
  { id: "calendar", label: "Calendar", path: "calendar", iconName: "calendar", permission: "people.view" },
  { id: "people", label: "People", path: "people", iconName: "users", permission: "people.view" },
  { id: "pipelines", label: "Pipelines", path: "pipelines", iconName: "kanban", permission: "people.view" },
  { id: "work", label: "Work", path: "work", iconName: "inbox", permission: "work.view" },
  { id: "inbox", label: "Inbox", path: "inbox", iconName: "mail", permission: "work.view" },
  { id: "campaigns", label: "Campaigns", path: "campaigns", iconName: "mail", permission: "work.view" },
  { id: "ads", label: "Ads", path: "ads", iconName: "trending-up", permission: "performance.view" },
  {
    id: "subjects",
    label: "Properties",
    path: "properties",
    iconName: "home",
    permission: "people.view",
  },
  { id: "knowledge", label: "Knowledge", path: "knowledge", iconName: "book", permission: null },
  { id: "team", label: "Team", path: "team", iconName: "users", permission: "team.manage" },
  {
    id: "automations",
    label: "Automations",
    path: "automations",
    iconName: "zap",
    permission: "team.manage",
  },
  {
    id: "integrations",
    label: "Integrations",
    path: "integrations",
    iconName: "link",
    permission: "integrations.manage",
  },
  {
    id: "settings",
    label: "Settings",
    path: "settings",
    iconName: "settings",
    permission: "settings.manage",
  },
];

function hasPermission(permissions: Set<string> | string[], permission: string | null, role?: string): boolean {
  if (!permission) return true;
  if (role === "OWNER" || role === "PLATFORM_ADMIN") return true;
  const set = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  return set.has(permission);
}

export type SpecialtyNavSource = {
  moduleId?: string;
  label?: string;
  href?: string | null;
  specialtyHref?: string | null;
  surfaceKind?: string | null;
  ownerAdded?: boolean;
  primaryNavigationEligible?: boolean;
  iconName?: string | null;
  employeeId?: string | null;
};

/**
 * Build primary nav for the business shell. Labels may be terminology-adjusted by caller.
 * Specialty modules (owner_mod_* / specialty_ai_*) append after canonical items.
 */
export function getCanonicalBusinessNav(
  businessId: string,
  permissions?: Set<string> | string[],
  options?: {
    role?: string;
    subjectLabel?: string;
    /**
     * The installed Business OS is the source of truth for vertical-only
     * surfaces.  In particular, a non-property business must never receive
     * the property portfolio simply because it uses BusinessSubject records.
     */
    installedModuleIds?: string[] | null;
    specialtyModules?: SpecialtyNavSource[] | null;
    /** Commercial SKUs — thin packages hide Calendar/Team/Automations etc. */
    purchasedPackages?: string[] | null;
    /**
     * Owner-editable per-role module deny list — `installation.configuration.roles`
     * entries with `{ membershipRole, deniedModules }` (see BusinessOSRoleAccessConfig.js
     * / RoleAccessPanel). Applied on top of permission-based visibility so a
     * denied module never appears in the primary nav for that role, even if
     * the role otherwise has the underlying permission.
     */
    roleDefinitions?: Array<Record<string, unknown>> | null;
  },
): CanonicalNavItem[] {
  const base = `/b/${encodeURIComponent(businessId)}`;
  const installedModuleIds = Array.isArray(options?.installedModuleIds)
    ? new Set(options!.installedModuleIds.map(String))
    : null;
  // Legacy property portfolios are opt-in only. A missing or incomplete
  // installation must never make a new dental or sports workspace look like
  // a property-management product.
  const hasPropertyPortfolio = installedModuleIds?.has("properties") === true;
  // Owner and platform admin always see everything — deny lists are not
  // editable for those roles (see EDITABLE_MEMBERSHIP_ROLES) and must never
  // lock out the person who configures access in the first place.
  const isUnrestrictedRole = options?.role === "OWNER" || options?.role === "PLATFORM_ADMIN";
  const deniedModuleIds = isUnrestrictedRole
    ? new Set<string>()
    : new Set(
      resolveRoleAccess({
        configuration: { roles: options?.roleDefinitions ?? [] },
        membershipRole: options?.role ?? "EMPLOYEE",
        permissions: permissions ?? [],
      }).deniedModuleIds,
    );
  const permissionFiltered = CANONICAL_ORDER.filter((item) => (
    hasPermission(permissions ?? [], item.permission, options?.role)
    && (item.id !== "subjects" || hasPropertyPortfolio)
    && !deniedModuleIds.has(item.id)
  ));
  const packageFiltered = filterCanonicalNavForPurchasedPackages(
    permissionFiltered,
    options?.purchasedPackages ?? [],
  );
  const allowSpecialtyTeammates = !options?.purchasedPackages?.length
    || packageFiltered.some((item) => item.id === "team");
  const canonical = packageFiltered.map(
    (item) => ({
      id: item.id,
      label: item.id === "subjects" ? options?.subjectLabel ?? "Properties" : item.label,
      href: `${base}/${item.path}`,
      iconName: item.iconName,
      permission: item.permission,
      badgeKey: item.badgeKey ?? null,
    }),
  );

  const specialty = (Array.isArray(options?.specialtyModules) ? options!.specialtyModules! : [])
    .filter((module) => {
      if (!allowSpecialtyTeammates) return false;
      if (module.primaryNavigationEligible === false) return false;
      const id = String(module.moduleId ?? "");
      const isSpecialty = Boolean(
        module.surfaceKind
        || module.ownerAdded
        || id.startsWith("owner_mod_")
        || id.startsWith("specialty_ai_"),
      );
      return isSpecialty && (module.href || module.specialtyHref || id);
    })
    .map((module) => {
      const moduleId = String(module.moduleId);
      const employeeId = module.employeeId ? String(module.employeeId) : null;
      const surfaceId = (module.surfaceKind === "ai_teammate" || moduleId.startsWith("specialty_ai_"))
        && employeeId
        ? employeeId
        : (moduleId.startsWith("specialty_ai_")
          ? moduleId.slice("specialty_ai_".length)
          : moduleId);
      const href = String(
        module.href
        || module.specialtyHref
        || `${base}/specialty/${encodeURIComponent(surfaceId)}`,
      );
      const normalizedHref = href.startsWith("/b/")
        ? href
        : `${base}/specialty/${encodeURIComponent(surfaceId)}`;
      // Prefer employee specialty path for AI teammates so nav highlight matches Team redirects.
      const finalHref = (module.surfaceKind === "ai_teammate" || moduleId.startsWith("specialty_ai_"))
        ? `${base}/specialty/${encodeURIComponent(surfaceId)}`
        : normalizedHref;
      return {
        id: `specialty_${moduleId}`,
        label: String(module.label ?? moduleId),
        href: finalHref,
        iconName: String(module.iconName || (module.surfaceKind === "ai_teammate" ? "users" : "folder")),
        permission: null as string | null,
        badgeKey: null as "needsAttention" | null,
      };
    });

  // Keep unique by href; specialty after Team, before Integrations when possible.
  const seen = new Set(canonical.map((item) => item.href));
  const uniqueSpecialty = specialty.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });

  const teamIndex = canonical.findIndex((item) => item.id === "team");
  if (teamIndex >= 0) {
    return [
      ...canonical.slice(0, teamIndex + 1),
      ...uniqueSpecialty,
      ...canonical.slice(teamIndex + 1),
    ];
  }
  return [...canonical, ...uniqueSpecialty];
}

/** Paths that should redirect into canonical destinations (relative to business). */
export const CANONICAL_REDIRECTS: Record<string, string> = {
  "mission-control": "home",
  "for-you": "intelligence",
  attention: "intelligence",
  engagement: "people",
  performance: "home",
  analytics: "home",
  "digital-workforce": "team",
  // Keep legacy automations→integrations redirect out — Automations is first-class now.
};
