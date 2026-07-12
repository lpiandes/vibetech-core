/**
 * Canonical primary navigation for `/b/[businessId]/**`.
 * Secondary destinations (Mission Control, For You, Performance, Engagement)
 * map into Home / Needs Attention / People without competing in the main nav.
 */

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
  { id: "people", label: "People", path: "people", iconName: "users", permission: "people.view" },
  { id: "work", label: "Work", path: "work", iconName: "inbox", permission: "work.view" },
  {
    id: "subjects",
    label: "Subjects",
    path: "properties",
    iconName: "home",
    permission: "people.view",
  },
  { id: "knowledge", label: "Knowledge", path: "knowledge", iconName: "book", permission: null },
  { id: "team", label: "Team", path: "team", iconName: "users", permission: "team.manage" },
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

/**
 * Build primary nav for the business shell. Labels may be terminology-adjusted by caller.
 */
export function getCanonicalBusinessNav(
  businessId: string,
  permissions?: Set<string> | string[],
  options?: {
    role?: string;
    subjectLabel?: string;
  },
): CanonicalNavItem[] {
  const base = `/b/${encodeURIComponent(businessId)}`;
  return CANONICAL_ORDER.filter((item) => hasPermission(permissions ?? [], item.permission, options?.role)).map(
    (item) => ({
      id: item.id,
      label: item.id === "subjects" ? options?.subjectLabel ?? "Subjects / Properties" : item.label,
      href: `${base}/${item.path}`,
      iconName: item.iconName,
      permission: item.permission,
      badgeKey: item.badgeKey ?? null,
    }),
  );
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
};
