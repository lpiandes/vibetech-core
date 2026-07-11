import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function moduleById(modules, moduleId) {
  return asArray(modules).find((module) => module.moduleId === moduleId) ?? null;
}

/**
 * Builds primary/secondary/utility navigation from modules.
 * Employees never become top-level sidebar tabs.
 */
export function buildBusinessOSNavigation({
  modules = [],
  navigation = {},
  role = null,
  permissions = null,
} = {}) {
  const maxPrimary = Number(navigation.maximumPrimaryItems ?? 8);
  const overflowBehavior = String(navigation.overflowBehavior ?? "more");
  const roleOverrides = navigation.roleOverrides?.[role] ?? null;
  const permissionSet = permissions instanceof Set
    ? permissions
    : new Set(Array.isArray(permissions) ? permissions : []);

  const configuredPrimary = asArray(roleOverrides?.primaryItems ?? navigation.primaryItems);
  const eligibleModules = asArray(modules)
    .filter((module) => module.primaryNavigationEligible !== false)
    .sort((a, b) => Number(a.navigationPriority ?? 100) - Number(b.navigationPriority ?? 100));

  let primarySource = configuredPrimary.length
    ? configuredPrimary.map((item) => {
        const module = moduleById(modules, item.moduleId ?? item.id);
        return {
          id: `nav_${item.moduleId ?? item.id}`,
          moduleId: item.moduleId ?? item.id,
          label: item.label ?? module?.label ?? String(item.moduleId ?? item.id),
          href: item.href ?? module?.href ?? null,
          iconName: item.iconName ?? module?.iconName ?? "folder",
          permission: item.permission ?? module?.roleVisibility?.[0] ?? null,
        };
      })
    : eligibleModules.map((module) => ({
        id: `nav_${module.moduleId}`,
        moduleId: module.moduleId,
        label: module.label,
        href: module.href ?? null,
        iconName: module.iconName ?? "folder",
        permission: asArray(module.roleVisibility)[0] ?? null,
      }));

  if (permissionSet.size > 0) {
    primarySource = primarySource.filter((item) => !item.permission || permissionSet.has(item.permission));
  }

  // Digital workforce / employees stay grouped — never explode into primary tabs.
  primarySource = primarySource.filter((item) => {
    const module = moduleById(modules, item.moduleId);
    if (!module) return true;
    return module.moduleType !== "workforce" || item.moduleId === "digital_workforce" || item.moduleId === "team";
  });

  let primaryItems = primarySource;
  let overflowItems = [];
  if (primarySource.length > maxPrimary && overflowBehavior === "more") {
    primaryItems = primarySource.slice(0, Math.max(0, maxPrimary - 1));
    overflowItems = primarySource.slice(Math.max(0, maxPrimary - 1));
    primaryItems.push({
      id: "nav_more",
      moduleId: "more",
      label: "More",
      href: null,
      iconName: "more",
      permission: null,
      overflowItems,
    });
  }

  const secondaryItemsByModule = {};
  for (const module of asArray(modules)) {
    const configured = navigation.secondaryItemsByModule?.[module.moduleId]
      ?? module.secondaryNavigationItems
      ?? [];
    secondaryItemsByModule[module.moduleId] = asArray(configured).map((item) => ({
      id: item.id ?? `sec_${module.moduleId}_${item.label}`,
      label: item.label,
      href: item.href ?? null,
    }));
  }

  const utilityItems = asArray(navigation.utilityItems).map((item) => ({
    id: item.id ?? `util_${item.label}`,
    label: item.label,
    href: item.href ?? null,
  }));

  return deepFreeze({
    primaryItems,
    overflowItems,
    secondaryItemsByModule,
    utilityItems,
    maximumPrimaryItems: maxPrimary,
    overflowBehavior,
    employeePlacement: "digital_workforce",
  });
}

/**
 * Client-safe terminology mapping. Presentation only — never renames runtimes.
 */
export function applyBusinessOSTerminology({ terminology = {}, concept } = {}) {
  const map = terminology?.presentation ?? terminology ?? {};
  const key = String(concept ?? "");
  return map[key] ?? map.entityLabels?.[key] ?? null;
}
