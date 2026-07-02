import { deepFreeze } from "../_utils/deepFreeze.js";

function sectionTitle(sectionId) {
  // Presentation titles for the navigation UI.
  switch (sectionId) {
    case "Knowledge":
      return "Knowledge";
    case "Team":
      return "Team";
    case "Work":
      return "Work";
    case "Company":
      return "Company";
    case "Analytics":
      return "Analytics";
    case "Settings":
      return "Settings";
    case "Mission Control":
      return "Mission Control";
    default:
      return String(sectionId);
  }
}

export function buildNavigationView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("NavigationViewBuilder: workspaceConfig required.");
  }

  const enabledModuleIds = new Set((workspaceConfig.modules ?? []).map((m) => String(m.id)));

  const items = Array.isArray(workspaceConfig.navigation?.items)
    ? workspaceConfig.navigation.items
    : [];

  const sections = items.map((section) => {
    const moduleItems = Array.isArray(section.items) ? section.items : [];
    const filtered = moduleItems
      .filter((it) => enabledModuleIds.has(String(it.moduleId)))
      .map((it) => ({
        id: `nav_${String(it.moduleId)}`,
        moduleId: String(it.moduleId),
        title: String(it.title ?? it.moduleId),
        section: String(section.section ?? "Workspace"),
        visibility: "VISIBLE",
        status: "READY",
      }));

    return {
      id: `nav_section_${String(section.section ?? "Workspace")}`,
      title: sectionTitle(section.section),
      displayOrder: 0,
      visibility: filtered.length ? "VISIBLE" : "HIDDEN",
      status: filtered.length ? "READY" : "EMPTY",
      items: filtered,
    };
  });

  return deepFreeze({
    id: "navigation_view",
    title: "Navigation",
    subtitle: "Modules and capabilities entry points",
    icon: "route",
    badges: [],
    actions: [],
    displayOrder: 20,
    visibility: "VISIBLE",
    status: "READY",
    sections,
  });
}

