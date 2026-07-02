import { MODULE_REGISTRY } from "./WorkspaceDefaults.js";
import { createWorkspaceModule } from "./WorkspaceModule.js";

export function createDefaultWorkspaceModules() {
  return MODULE_REGISTRY.map((m) => createWorkspaceModule(m));
}

