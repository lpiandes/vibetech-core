import {
  ACTION_ROUTE_MAP,
  isRegisteredWidget,
  resolveActionHref,
  resolveModulePresentation,
} from "./registries.js";
import { compileSpecialtySurfacesOnSpecification } from "../../../backend/core/ai-builder/specialty/SpecialtySurfaceCompiler.js";

/**
 * Pure portal composition from installed Business OS (+ optional full specification).
 * No React. No dynamic UI generation.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function applyTerminology(label, terminology = null, entityKey = null) {
  if (!terminology) return label;
  const pages = terminology.pages ?? terminology.presentation?.pages ?? {};
  const entities = terminology.entityLabels ?? terminology.presentation?.entityLabels ?? {};
  if (entityKey && entities[entityKey]) return String(entities[entityKey]);
  if (label && pages[label]) return String(pages[label]);
  if (label && entities[label]) return String(entities[label]);
  return label;
}

export function enrichModules({ configuration = {}, specification = null } = {}) {
  const installed = asArray(configuration.modules);
  const specModules = asArray(specification?.modules);
  const byId = new Map(specModules.map((module) => [String(module.moduleId), module]));

  const enriched = installed.map((module) => {
    const full = byId.get(String(module.moduleId)) ?? {};
    const presentation = resolveModulePresentation(module.moduleId, full.viewType ?? module.viewType);
    return {
      ...full,
      ...module,
      label: module.label ?? full.label,
      moduleType: module.moduleType ?? full.moduleType ?? "operations",
      navigationPriority: full.navigationPriority ?? module.navigationPriority ?? 99,
      primaryNavigationEligible: full.primaryNavigationEligible ?? module.primaryNavigationEligible ?? true,
      roleVisibility: full.roleVisibility ?? module.roleVisibility ?? [],
      iconName: full.iconName ?? module.iconName ?? null,
      primaryActions: full.primaryActions ?? module.primaryActions ?? [],
      emptyState: full.emptyState ?? module.emptyState ?? null,
      viewType: presentation.viewType,
      presentationAllowed: presentation.allowed,
    };
  });

  // Spec modules missing from thin install payloads still contribute when present.
  for (const module of specModules) {
    if (enriched.some((entry) => entry.moduleId === module.moduleId)) continue;
    const presentation = resolveModulePresentation(module.moduleId, module.viewType);
    enriched.push({
      ...module,
      viewType: presentation.viewType,
      presentationAllowed: presentation.allowed,
    });
  }

  return enriched.sort((a, b) => Number(a.navigationPriority ?? 99) - Number(b.navigationPriority ?? 99));
}

export function resolveDashboards({ configuration = {}, specification = null } = {}) {
  const fromConfig = asArray(configuration.dashboards);
  const fromSpec = asArray(specification?.dashboardDefinitions);
  const source = fromConfig.length ? fromConfig : fromSpec;

  return source.map((dashboard) => {
    const widgets = asArray(dashboard.widgets ?? dashboard.cards).map((widget, index) => {
      const componentType = String(widget.componentType ?? widget.type ?? "");
      return {
        id: widget.id ?? `widget_${index}`,
        componentType,
        label: widget.label ?? componentType,
        dataSource: widget.dataSource ?? null,
        registered: isRegisteredWidget(componentType),
      };
    });
    return {
      dashboardId: dashboard.dashboardId ?? dashboard.id ?? "home",
      label: dashboard.label ?? "Home",
      roleVisibility: dashboard.roleVisibility ?? [],
      widgets,
      rejectedWidgets: widgets.filter((widget) => !widget.registered).map((widget) => widget.componentType),
      acceptedWidgets: widgets.filter((widget) => widget.registered),
    };
  });
}

export function resolveEmptyStates({ modules = [], terminology = null } = {}) {
  const byModule = {};
  for (const module of modules) {
    const label = applyTerminology(module.label, terminology);
    byModule[module.moduleId] = {
      moduleId: module.moduleId,
      title: label,
      description: module.emptyState
        ?? `No ${String(label).toLowerCase()} yet. Add the first item to get started.`,
    };
  }
  return byModule;
}

export function resolvePrimaryActions({ modules = [], businessId, terminology = null } = {}) {
  const actions = [];
  for (const module of modules) {
    for (const actionId of asArray(module.primaryActions)) {
      if (!ACTION_ROUTE_MAP[String(actionId)]) continue;
      const href = resolveActionHref(actionId, businessId);
      if (!href) continue;
      actions.push({
        id: String(actionId),
        label: applyTerminology(humanize(actionId), terminology),
        href,
        moduleId: module.moduleId,
      });
    }
  }
  // Always allow knowledge + invite when those modules exist.
  if (modules.some((module) => module.moduleId === "knowledge")) {
    actions.push({
      id: "add_knowledge",
      label: applyTerminology("Add knowledge", terminology),
      href: `/b/${businessId}/knowledge?add=1`,
      moduleId: "knowledge",
    });
  }
  if (modules.some((module) => module.moduleId === "digital_workforce" || module.moduleId === "team")) {
    actions.push({
      id: "invite_team",
      label: applyTerminology("Invite team", terminology),
      href: `/b/${businessId}/team`,
      moduleId: "team",
    });
  }
  return uniqueBy(actions, (action) => action.id).slice(0, 6);
}

function humanize(value) {
  return String(value ?? "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sectionIdForModuleType(moduleType) {
  switch (String(moduleType ?? "")) {
    case "workforce":
    case "knowledge":
    case "analytics":
      return "business";
    case "configuration":
      return "system";
    default:
      return "daily";
  }
}

/**
 * Compose the full portal model from Business OS installation + optional specification.
 */
export function composePortalModel({
  businessId,
  role = "EMPLOYEE",
  permissions = [],
  configuration = null,
  specification = null,
} = {}) {
  const config = configuration ?? {};
  const terminology = config.terminology ?? specification?.terminology ?? null;

  // Ensure specialty nav modules exist even for installs that predate SpecialtySurfaceCompiler.
  // Prefer specification modules; thin config modules only fill gaps (avoid dupes wiping enrich fields).
  const modulesForSpecialty = (() => {
    const byId = new Map();
    for (const module of asArray(config.modules)) {
      byId.set(String(module.moduleId), module);
    }
    for (const module of asArray(specification?.modules)) {
      const id = String(module.moduleId);
      byId.set(id, { ...(byId.get(id) ?? {}), ...module });
    }
    return [...byId.values()];
  })();
  const employeesForSpecialty = (() => {
    const byId = new Map();
    for (const employee of asArray(config.employees)) {
      byId.set(String(employee.employeeId ?? employee.id), employee);
    }
    for (const employee of asArray(specification?.employeeDefinitions)) {
      const id = String(employee.employeeId ?? employee.id);
      byId.set(id, { ...(byId.get(id) ?? {}), ...employee });
    }
    return [...byId.values()];
  })();

  const specialtySpec = compileSpecialtySurfacesOnSpecification({
    ...(specification ?? {}),
    modules: modulesForSpecialty,
    employeeDefinitions: employeesForSpecialty,
    businessId: businessId ?? specification?.businessId ?? null,
  }, { businessId: businessId ?? null });

  const modules = enrichModules({
    configuration: config,
    specification: {
      ...(specification ?? {}),
      modules: specialtySpec.modules,
      employeeDefinitions: specialtySpec.employeeDefinitions,
    },
  });
  const dashboards = resolveDashboards({ configuration: config, specification });
  const emptyStates = resolveEmptyStates({ modules, terminology });
  const primaryActions = businessId
    ? resolvePrimaryActions({ modules, businessId, terminology })
    : [];

  const homeDashboard = dashboards.find((entry) => {
    const id = String(entry.dashboardId);
    return id === "owner_home" || id === "home" || id.includes("home");
  }) ?? dashboards[0] ?? null;

  const subjectTypes = asArray(config.subjectTypes?.length ? config.subjectTypes : specification?.subjectDefinitions)
    .map((entry) => entry.subjectType ?? entry.type ?? entry.id)
    .filter(Boolean);

  return {
    drivenByBusinessOS: Boolean(configuration || specification),
    businessId: businessId ?? null,
    role,
    permissions: Array.from(permissions ?? []),
    terminology,
    modules,
    navigation: config.navigation ?? specification?.navigation ?? null,
    dashboards,
    homeDashboard,
    emptyStates,
    primaryActions,
    subjectTypes,
    roles: config.roles ?? config.roleDefinitions ?? specification?.roleDefinitions ?? [],
    landingModuleId: modules.find((module) => module.moduleId === "home")?.moduleId
      ?? modules[0]?.moduleId
      ?? "home",
  };
}

export function selectHomeDashboardWidgets(portalModel) {
  if (!portalModel?.homeDashboard) return [];
  return portalModel.homeDashboard.acceptedWidgets;
}
