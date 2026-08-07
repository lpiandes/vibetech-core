/**
 * Canonical navigation for `/b/[businessId]/**`.
 * Primary IA (Plan 3): Today · Decisions · Outcomes · Company Rules.
 * Records: evidence + secondary admin (Calendar, Work, Team, Connections).
 * System: Settings only for beachhead.
 */

import { filterCanonicalNavForPurchasedPackages } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { resolveRoleAccess as resolveRoleAccessRaw } from "../../../backend/core/business-os/BusinessOSRoleAccess.js";

const resolveRoleAccess = resolveRoleAccessRaw as (input: Record<string, unknown>) => {
  deniedModuleIds: string[];
};

export type NavGroup = "primary" | "records" | "system";

export type CanonicalNavItem = {
  id: string;
  label: string;
  href: string;
  iconName: string;
  permission: string | null;
  group: NavGroup;
  /** Badge source key — shell may overlay live counts */
  badgeKey?: "needsAttention" | null;
};

type NavDef = {
  id: string;
  label: string;
  path: string;
  iconName: string;
  permission: string | null;
  group: NavGroup;
  badgeKey?: "needsAttention";
};

const CANONICAL_ORDER: NavDef[] = [
  // Primary — managed operation
  { id: "home", label: "Today", path: "home", iconName: "home", permission: null, group: "primary" },
  {
    id: "needs_attention",
    label: "Decisions",
    path: "intelligence",
    iconName: "alert-circle",
    permission: null,
    group: "primary",
    badgeKey: "needsAttention",
  },
  {
    id: "outcomes",
    label: "Outcomes",
    path: "outcomes",
    iconName: "check-circle",
    permission: "work.view",
    group: "primary",
  },
  {
    id: "knowledge",
    label: "Company Rules",
    path: "knowledge",
    iconName: "book",
    permission: null,
    group: "primary",
  },
  // Records — evidence + secondary admin (Plan 28: no CRM-primary People/Pipelines/Inbox theater)
  { id: "calendar", label: "Calendar", path: "calendar", iconName: "calendar", permission: "people.view", group: "records" },
  { id: "work", label: "Work", path: "work", iconName: "inbox", permission: "work.view", group: "records" },
  {
    id: "subjects",
    label: "Properties",
    path: "properties",
    iconName: "home",
    permission: "people.view",
    group: "records",
  },
  { id: "team", label: "Team", path: "team", iconName: "users", permission: "team.manage", group: "records" },
  {
    id: "integrations",
    label: "Connections",
    path: "integrations",
    iconName: "link",
    permission: "integrations.manage",
    group: "records",
  },
  // System — Settings only for beachhead (no Automations builder as product)
  {
    id: "settings",
    label: "Settings",
    path: "settings",
    iconName: "settings",
    permission: "settings.manage",
    group: "system",
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
 * Build shell nav. Labels may be terminology-adjusted by caller.
 * Specialty modules append in the Records group after Team.
 */
export function getCanonicalBusinessNav(
  businessId: string,
  permissions?: Set<string> | string[],
  options?: {
    role?: string;
    subjectLabel?: string;
    installedModuleIds?: string[] | null;
    specialtyModules?: SpecialtyNavSource[] | null;
    purchasedPackages?: string[] | null;
    roleDefinitions?: Array<Record<string, unknown>> | null;
  },
): CanonicalNavItem[] {
  const base = `/b/${encodeURIComponent(businessId)}`;
  const installedModuleIds = Array.isArray(options?.installedModuleIds)
    ? new Set(options!.installedModuleIds.map(String))
    : null;
  const hasPropertyPortfolio = installedModuleIds?.has("properties") === true;
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
      group: item.group,
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
      const finalHref = (module.surfaceKind === "ai_teammate" || moduleId.startsWith("specialty_ai_"))
        ? `${base}/specialty/${encodeURIComponent(surfaceId)}`
        : normalizedHref;
      return {
        id: `specialty_${moduleId}`,
        label: String(module.label ?? moduleId),
        href: finalHref,
        iconName: String(module.iconName || (module.surfaceKind === "ai_teammate" ? "users" : "folder")),
        permission: null as string | null,
        group: "records" as NavGroup,
        badgeKey: null as "needsAttention" | null,
      };
    });

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

/** Group nav items for sectioned shell rendering. */
export function groupCanonicalNav(items: CanonicalNavItem[]): {
  primary: CanonicalNavItem[];
  records: CanonicalNavItem[];
  system: CanonicalNavItem[];
} {
  return {
    primary: items.filter((item) => item.group === "primary"),
    records: items.filter((item) => item.group === "records"),
    system: items.filter((item) => item.group === "system" || !item.group),
  };
}

/** Paths that should redirect into canonical destinations (relative to business). */
export const CANONICAL_REDIRECTS: Record<string, string> = {
  "mission-control": "home",
  "for-you": "intelligence",
  attention: "intelligence",
  decisions: "intelligence",
  "company-rules": "knowledge",
  engagement: "work",
  people: "work",
  pipelines: "work",
  inbox: "intelligence",
  performance: "home",
  analytics: "home",
  "digital-workforce": "team",
};
