const ROUTES_BY_MODULE_ID = {
  home: "/home",
  command_center: "/mission-control",
  attention: "/attention",
  audiences: "/audiences",
  digital_workforce: "/team",
  work_queue: "/work",
  knowledge: "/knowledge",
  dashboard: "/company",
  analytics: "/analytics",
  settings: "/settings",
  communications: "/communications",
  connections: "/connections",
  setup: "/setup",
  automations: "/automations",
  engagement: "/engagement",
  request: "/request",
};

function getRouteForModuleId(moduleId) {
  return ROUTES_BY_MODULE_ID[String(moduleId)] ?? null;
}

function flattenNavigationItems(navigation) {
  const sections = Array.isArray(navigation?.sections) ? navigation.sections : [];
  const out = [];
  for (const section of sections) {
    const items = Array.isArray(section?.items) ? section.items : [];
    for (const it of items) out.push(it);
  }
  return out;
}

export function derivePackageNavItems(workspaceViewModel) {
  const packageNavigation = workspaceViewModel?.packageNavigation;
  const items = Array.isArray(packageNavigation?.items) ? packageNavigation.items : [];
  if (items.length === 0) return deriveSidebarNavItems(workspaceViewModel);
  return Object.freeze(items.map((x) => Object.freeze({ ...x })));
}

export function deriveSidebarNavItems(workspaceViewModel) {
  const packageItems = workspaceViewModel?.packageNavigation?.items;
  if (Array.isArray(packageItems) && packageItems.length > 0) {
    return derivePackageNavItems(workspaceViewModel);
  }

  const navigation = workspaceViewModel?.navigation;
  const modulesView = workspaceViewModel?.modules;
  const moduleList = Array.isArray(modulesView?.modules) ? modulesView.modules : [];
  const modulesById = new Map(moduleList.map((m) => [String(m.moduleId), m]));

  const navItems = [];
  const navOrderItems = flattenNavigationItems(navigation);

  for (const navItem of navOrderItems) {
    const moduleId = String(navItem?.moduleId ?? "");
    if (!moduleId) continue;

    const module = modulesById.get(moduleId);
    const iconName = module?.icon ?? null;
    const label = String(navItem?.title ?? module?.title ?? moduleId);

    const href = getRouteForModuleId(moduleId);
    if (!href) continue; // prevent missing routes from leaking into shell

    navItems.push({
      id: `nav_${moduleId}`,
      moduleId,
      label,
      iconName,
      href,
      visibility: String(navItem?.visibility ?? "VISIBLE"),
      status: String(navItem?.status ?? "READY"),
      displayOrder: navItems.length,
      badges: Array.isArray(module?.badges) ? module.badges : [],
    });
  }

  for (let i = 0; i < navItems.length; i += 1) navItems[i].displayOrder = i;

  return Object.freeze(navItems.map((x) => Object.freeze(x)));
}

export function validateWorkspaceShellViewModel(workspaceViewModel) {
  const navigation = workspaceViewModel?.navigation;
  const modulesView = workspaceViewModel?.modules;

  const derived = deriveSidebarNavItems(workspaceViewModel);

  const ids = derived.map((x) => x.id);
  const dupe = ids.find((id, idx) => ids.indexOf(id) !== idx);
  if (dupe) throw new Error(`WorkspaceShellValidation: duplicate navigation ids: ${dupe}`);

  // Validate icons exist for modules that are present.
  for (const item of derived) {
    if (!item.iconName) throw new Error(`WorkspaceShellValidation: missing icon for module: ${item.moduleId}`);
  }

  // Validate ordering matches navigation flattening order.
  const expectedOrderModuleIds = flattenNavigationItems(navigation)
    .map((it) => String(it?.moduleId ?? ""))
    .filter(Boolean)
    .filter((moduleId) => Boolean(getRouteForModuleId(moduleId)));

  const actualOrderModuleIds = derived.map((x) => x.moduleId);
  if (expectedOrderModuleIds.length !== actualOrderModuleIds.length) {
    throw new Error(`WorkspaceShellValidation: missing or extra nav items (expected=${expectedOrderModuleIds.length}, actual=${actualOrderModuleIds.length})`);
  }
  for (let i = 0; i < expectedOrderModuleIds.length; i++) {
    if (expectedOrderModuleIds[i] !== actualOrderModuleIds[i]) {
      throw new Error(`WorkspaceShellValidation: ordering mismatch at index ${i}`);
    }
  }

  return Object.freeze({ ok: true });
}

export function getActiveModuleIdFromPathname(pathname) {
  const path = String(pathname ?? "");
  const businessMatch = path.match(/^\/b\/[^/]+\/([^/]+)/);
  if (businessMatch) {
    const segment = businessMatch[1];
    if (segment === "home") return "home";
    if (segment === "for-you") return "command_center";
    if (segment === "work") return "work_queue";
    if (segment === "people") return "engagement";
    if (segment === "calendar") return "calendar";
    if (segment === "pipelines") return "pipelines";
    if (segment === "automations") return "automations";
    if (segment === "properties") return "properties";
    if (segment === "inbox") return "communications";
    if (segment === "team") return "digital_workforce";
    if (segment === "knowledge") return "knowledge";
    if (segment === "performance") return "analytics";
    if (segment === "integrations") return "connections";
    if (segment === "settings") return "setup";
  }

  if (path === "/home") return "home";
  if (path === "/mission-control") return "command_center";
  if (path === "/audiences") return "audiences";
  if (path === "/attention") return "attention";
  if (path === "/communications") return "communications";
  if (path === "/connections") return "connections";
  if (path === "/setup") return "setup";
  if (path === "/automations") return "automations";
  if (path.startsWith("/engagement")) return "engagement";
  // Primary routes
  if (path === "/team") return "digital_workforce";
  if (path === "/work") return "work_queue";
  if (path.startsWith("/work/")) return "work_queue";
  if (path === "/knowledge") return "knowledge";
  if (path === "/company") return "dashboard";
  if (path === "/analytics") return "analytics";
  if (path === "/settings") return "settings";

  // Legacy compatibility routes
  if (path === "/dashboard") return "dashboard";
  if (path === "/digital-workforce") return "digital_workforce";
  if (path.startsWith("/work-queue")) return "work_queue";
  return null;
}

export { getRouteForModuleId };

