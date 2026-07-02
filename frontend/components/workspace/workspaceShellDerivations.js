const ROUTES_BY_MODULE_ID = {
  dashboard: "/dashboard",
  digital_workforce: "/digital-workforce",
  work_queue: "/work-queue",
  // Future routing generated later in Sprint 4.
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

export function deriveSidebarNavItems(workspaceViewModel) {
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
  if (path === "/dashboard") return "dashboard";
  if (path === "/digital-workforce") return "digital_workforce";
  if (path.startsWith("/work-queue")) return "work_queue";
  return null;
}

export { getRouteForModuleId };

