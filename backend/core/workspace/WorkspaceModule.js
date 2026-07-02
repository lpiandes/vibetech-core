import { deepFreeze } from "./_utils/deepFreeze.js";

export function createWorkspaceModule(moduleDef = {}) {
  const {
    id,
    title,
    description,
    navigation,
    supportedIndustries,
    requiredCapabilities,
    requiredConnectedSystems,
    requiredKnowledge,
    requiredEmployees,
    defaultWidgets,
    defaultQueues,
    permissions,
    metadata,
  } = moduleDef ?? {};

  if (!id || typeof id !== "string") throw new Error("WorkspaceModule: id required.");
  if (!title || typeof title !== "string") throw new Error("WorkspaceModule: title required.");

  const mod = {
    id: String(id),
    title: String(title),
    description: String(description ?? ""),
    navigation: navigation ?? { section: "Workspace", item: String(title) },
    supportedIndustries: Array.isArray(supportedIndustries) ? supportedIndustries.map(String) : ["any"],
    requiredCapabilities: Array.isArray(requiredCapabilities) ? requiredCapabilities.map(String) : [],
    requiredConnectedSystems: Array.isArray(requiredConnectedSystems)
      ? requiredConnectedSystems.map(String)
      : [],
    requiredKnowledge: Array.isArray(requiredKnowledge) ? requiredKnowledge.map(String) : [],
    requiredEmployees: Array.isArray(requiredEmployees) ? requiredEmployees.map(String) : [],
    defaultWidgets: Array.isArray(defaultWidgets) ? defaultWidgets.map(String) : [],
    defaultQueues: Array.isArray(defaultQueues) ? defaultQueues.map(String) : [],
    permissions: permissions && typeof permissions === "object" ? deepFreeze({ ...permissions }) : deepFreeze({}),
    metadata: metadata && typeof metadata === "object" ? deepFreeze({ ...metadata }) : deepFreeze({}),
  };

  return deepFreeze(mod);
}

