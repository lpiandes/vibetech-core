import { buildBusinessOSNavigation as buildBusinessOSNavigationRaw } from "../../../backend/core/business-os/BusinessOSNavigationBuilder.js";
import {
  resolveSafeModuleHref as resolveSafeModuleHrefRaw,
  isSafeModuleRoute as isSafeModuleRouteRaw,
} from "../../../backend/core/business-os/BusinessOSSafeRoutes.js";
import { resolveRoleAccess as resolveRoleAccessRaw } from "../../../backend/core/business-os/BusinessOSRoleAccess.js";

const buildBusinessOSNavigation = buildBusinessOSNavigationRaw as (input: Record<string, unknown>) => {
  primaryItems: Array<{
    id?: string;
    moduleId: string;
    label: string;
    href?: string | null;
    iconName?: string;
    permission?: string | null;
    overflowItems?: unknown[];
  }>;
};
const resolveSafeModuleHref = resolveSafeModuleHrefRaw as (
  moduleId: string,
  options?: { businessId?: string | null },
) => string | null;
const isSafeModuleRoute = isSafeModuleRouteRaw as (moduleId: string) => boolean;
const resolveRoleAccess = resolveRoleAccessRaw as (input: Record<string, unknown>) => {
  visibleModuleIds: string[];
};

export type NavItem = {
  id: string;
  moduleId: string;
  label: string;
  iconName: string;
  href: string;
  permission: string | null;
  badges?: { type: string; value: string }[];
  overflowItems?: NavItem[];
};

export type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

type ModuleLike = {
  moduleId: string;
  label: string;
  moduleType?: string;
  navigationPriority?: number;
  primaryNavigationEligible?: boolean;
  roleVisibility?: string[];
  iconName?: string;
  href?: string | null;
  secondaryNavigationItems?: unknown[];
};

type InstalledNavigationInput = {
  modules?: ModuleLike[];
  navigation?: Record<string, unknown>;
  roleDefinitions?: unknown[];
  roles?: unknown[];
};

const DEFAULT_MCBRIDE_MODULES: ModuleLike[] = [
  { moduleId: "home", label: "Home", moduleType: "operations", navigationPriority: 1, iconName: "home", roleVisibility: [] },
  { moduleId: "for_you", label: "For you", moduleType: "operations", navigationPriority: 2, iconName: "home", roleVisibility: ["work.view"] },
  { moduleId: "work", label: "Work", moduleType: "operations", navigationPriority: 3, iconName: "inbox", roleVisibility: ["work.view"] },
  { moduleId: "people", label: "People", moduleType: "records", navigationPriority: 4, iconName: "users", roleVisibility: ["people.view"] },
  { moduleId: "properties", label: "Properties", moduleType: "records", navigationPriority: 5, iconName: "home", roleVisibility: ["people.view"] },
  { moduleId: "inbox", label: "Inbox", moduleType: "communications", navigationPriority: 6, iconName: "message-square", roleVisibility: ["inbox.view"] },
  { moduleId: "digital_workforce", label: "Team", moduleType: "workforce", navigationPriority: 7, iconName: "users", roleVisibility: ["team.manage"] },
  { moduleId: "knowledge", label: "Knowledge", moduleType: "knowledge", navigationPriority: 8, iconName: "book", roleVisibility: [] },
  { moduleId: "performance", label: "Performance", moduleType: "analytics", navigationPriority: 9, iconName: "chart", roleVisibility: ["performance.view"] },
  { moduleId: "integrations", label: "Integrations", moduleType: "configuration", navigationPriority: 10, iconName: "link", roleVisibility: ["integrations.manage"] },
  { moduleId: "settings", label: "Settings", moduleType: "configuration", navigationPriority: 11, iconName: "settings", roleVisibility: ["settings.manage"] },
];

const ICON_BY_MODULE: Record<string, string> = {
  home: "home",
  for_you: "home",
  work: "inbox",
  work_queue: "inbox",
  people: "users",
  properties: "home",
  inbox: "message-square",
  digital_workforce: "users",
  team: "users",
  knowledge: "book",
  performance: "chart",
  reports: "chart",
  integrations: "link",
  settings: "settings",
  teams: "users",
  players: "users",
  schedule: "inbox",
  practices: "inbox",
  drills: "book",
  scouting: "target",
};

/**
 * Module-driven navigation with McBride-compatible default fallback.
 * Only safe registered routes are emitted.
 */
export function getModuleDrivenNavSections(
  businessId: string,
  permissions?: Set<string> | string[],
  options?: {
    role?: string;
    installed?: InstalledNavigationInput | null;
    maximumPrimaryItems?: number;
  },
): NavSection[] {
  const permSet = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  const installed = options?.installed ?? null;
  const modules = (installed?.modules?.length ? installed.modules : DEFAULT_MCBRIDE_MODULES)
    .filter((module) => isSafeModuleRoute(module.moduleId) || module.moduleId === "for_you");

  const roleAccess = resolveRoleAccess({
    configuration: {
      modules,
      roles: installed?.roles ?? installed?.roleDefinitions,
    },
    membershipRole: options?.role ?? "EMPLOYEE",
    permissions: permSet,
  });
  const visible = new Set(roleAccess.visibleModuleIds);

  const navigation = buildBusinessOSNavigation({
    modules: modules
      .filter((module) => visible.has(module.moduleId))
      .map((module) => ({
        ...module,
        href: resolveSafeModuleHref(module.moduleId, { businessId }),
        iconName: module.iconName ?? ICON_BY_MODULE[module.moduleId] ?? "folder",
        primaryNavigationEligible: module.primaryNavigationEligible !== false,
      })),
    navigation: {
      maximumPrimaryItems: options?.maximumPrimaryItems ?? 8,
      overflowBehavior: "more",
      ...(installed?.navigation ?? {}),
      primaryItems: undefined,
    },
    permissions: permSet,
  });

  const toItem = (item: {
    id?: string;
    moduleId: string;
    label: string;
    href?: string | null;
    iconName?: string;
    permission?: string | null;
    overflowItems?: unknown[];
  }): NavItem | null => {
    if (item.moduleId === "more") {
      return {
        id: "nav_more",
        moduleId: "more",
        label: "More",
        iconName: "more",
        href: "",
        permission: null,
        overflowItems: (item.overflowItems as typeof item[] | undefined)
          ?.map((entry) => toItem(entry as typeof item))
          .filter(Boolean) as NavItem[],
      };
    }
    const href = item.href ?? resolveSafeModuleHref(item.moduleId, { businessId });
    if (!href) return null;
    return {
      id: item.id ?? `nav_${item.moduleId}`,
      moduleId: item.moduleId,
      label: item.label,
      iconName: item.iconName ?? ICON_BY_MODULE[item.moduleId] ?? "folder",
      href,
      permission: item.permission ?? null,
      badges: [],
    };
  };

  const primaryItems = navigation.primaryItems
    .map((item) => toItem(item))
    .filter(Boolean) as NavItem[];

  const can = (permission: string | null) => !permission || permSet.has(permission);
  const filtered = primaryItems.filter((item) => {
    if (item.moduleId === "more") return true;
    if (item.moduleId === "digital_workforce" || item.moduleId === "team") {
      return can("team.invite") || can("team.manage");
    }
    if (!visible.has(item.moduleId) && item.moduleId !== "for_you") return false;
    return can(item.permission);
  });

  const dailyIds = new Set(["home", "for_you", "work", "people", "properties", "inbox", "teams", "players", "schedule", "practices"]);
  const businessIds = new Set(["digital_workforce", "team", "knowledge", "performance", "reports", "drills", "scouting", "campaigns"]);
  const systemIds = new Set(["integrations", "settings", "readiness"]);

  const sections: NavSection[] = [
    { id: "daily", title: "", items: filtered.filter((item) => dailyIds.has(item.moduleId) || item.moduleId === "more") },
    { id: "business", title: "", items: filtered.filter((item) => businessIds.has(item.moduleId)) },
    { id: "system", title: "", items: filtered.filter((item) => systemIds.has(item.moduleId)) },
  ];

  // Keep overflow More attached to daily when present.
  const more = filtered.find((item) => item.moduleId === "more");
  if (more && !sections[0].items.some((item) => item.moduleId === "more")) {
    sections[0].items.push(more);
  }

  return sections.filter((section) => section.items.length > 0);
}

/** Backward-compatible McBride default — identical destinations to legacy simplified nav. */
export function getSimplifiedNavSections(businessId: string, permissions?: Set<string> | string[]) {
  return getModuleDrivenNavSections(businessId, permissions, { role: "OWNER" });
}
