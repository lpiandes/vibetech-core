import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createMissionControlAction({
  id,
  action,
  label,
  target,
  dependencies,
  status,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("MissionControlAction: id required.");
  if (!action || typeof action !== "string") throw new Error("MissionControlAction: action required.");
  if (!label || typeof label !== "string") throw new Error("MissionControlAction: label required.");
  if (!target || typeof target !== "string") throw new Error("MissionControlAction: target required.");

  const deps = Array.isArray(dependencies) ? dependencies.map(String) : [];
  const obj = {
    id,
    action,
    label,
    target,
    dependencies: deepFreeze(deps),
    status: status ? String(status) : "open",
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(obj);
}

