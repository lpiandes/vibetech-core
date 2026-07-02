import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ACTION_PRIORITIES, ACTION_STYLE_BY_PRIORITY } from "./WorkViewDefaults.js";

function fail(message) {
  throw new Error(`WorkActionView: ${message}`);
}

export function createWorkActionView({
  id,
  label,
  type,
  target,
  priority,
  disabled,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!label || typeof label !== "string") fail("label required.");
  if (!type || typeof type !== "string") fail("type required.");
  if (!target || typeof target !== "string") fail("target required.");

  const pr = String(priority ?? "later");
  if (!ACTION_PRIORITIES.includes(pr)) fail(`invalid priority: ${pr}`);

  const style = ACTION_STYLE_BY_PRIORITY[pr] ?? "neutral";

  const view = {
    id,
    label,
    type,
    target,
    priority: pr,
    style,
    disabled: Boolean(disabled),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

