import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { STYLE_MAP_BY_PRIORITY } from "./MissionControlViewDefaults.js";

function fail(message) {
  throw new Error(`MissionControlActionView: ${message}`);
}

function normalizePriority(priority) {
  const p = String(priority ?? "").toLowerCase();
  if (p === "immediate" || p === "primary") return "immediate";
  if (p === "soon" || p === "secondary") return "soon";
  if (p === "later" || p === "tertiary") return "later";
  return "later";
}

function typeFromAction(actionType) {
  return String(actionType ?? "");
}

export function createMissionControlActionView({
  id,
  label,
  type,
  target,
  priority,
  disabled,
  metadata,
} = {}) {
  if (!id) fail("id required.");
  if (!label) fail("label required.");
  if (!type) fail("type required.");
  if (!target) fail("target required.");

  const pr = normalizePriority(priority);
  const style = STYLE_MAP_BY_PRIORITY[pr];

  const view = {
    id: String(id),
    label: String(label),
    type: typeFromAction(type),
    target: String(target),
    style,
    priority: pr,
    disabled: Boolean(disabled),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

