import { deepFreeze } from "../_utils/deepFreeze.js";

function iconForModuleId(moduleId) {
  switch (moduleId) {
    case "dashboard":
      return "dashboard";
    case "knowledge":
      return "book";
    case "digital_workforce":
      return "users";
    case "work_queue":
      return "inbox";
    case "communications":
      return "mail";
    case "connections":
      return "plug";
    case "analytics":
      return "chart";
    case "company_health":
      return "activity-health";
    case "recommendations":
      return "sparkles";
    default:
      return "module";
  }
}

export function buildModulesView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("ModuleViewBuilder: workspaceConfig required.");
  }

  const modules = Array.isArray(workspaceConfig.modules) ? workspaceConfig.modules : [];

  const viewModules = modules.map((m) => {
    const id = String(m.id);
    return deepFreeze({
      id: `module_${id}`,
      moduleId: id,
      title: String(m.title ?? id),
      subtitle: String(m.description ?? ""),
      icon: iconForModuleId(id),
      badges: [],
      actions: [],
      displayOrder: 0,
      visibility: "VISIBLE",
      status: "READY",
      requiredCapabilities: Array.isArray(m.requiredCapabilities) ? m.requiredCapabilities.map(String) : [],
    });
  });

  // Stable ordering: deterministic by module navigation section/item.
  const ordered = [...viewModules].sort((a, b) => {
    const ad = a.title.localeCompare(b.title);
    return ad;
  });

  return deepFreeze({
    id: "modules_view",
    title: "Modules",
    subtitle: "What is enabled in this workspace",
    icon: "grid",
    badges: [],
    actions: [],
    displayOrder: 30,
    visibility: "VISIBLE",
    status: "READY",
    modules: ordered,
  });
}

