import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { ACTION_PRIORITIES, ACTION_STYLE_BY_PRIORITY } from "./TeamViewDefaults.js";

export function createTeamActionView({
  id,
  label,
  type,
  target,
  style,
  priority,
  disabled,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("TeamActionView: id required.");
  if (!label || typeof label !== "string") throw new Error("TeamActionView: label required.");
  if (!type || typeof type !== "string") throw new Error("TeamActionView: type required.");
  if (!target || typeof target !== "string") throw new Error("TeamActionView: target required.");

  const pr = String(priority ?? "later").toLowerCase();
  if (!ACTION_PRIORITIES.includes(pr)) throw new Error(`TeamActionView: invalid priority: ${pr}`);

  const st = style ? String(style) : ACTION_STYLE_BY_PRIORITY[pr] ?? "neutral";

  const obj = {
    id,
    label,
    type,
    target,
    style: st,
    priority: pr,
    disabled: Boolean(disabled),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(obj);
}

