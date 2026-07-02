import { deepFreeze } from "../_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`NavigationItem: ${message}`);
}

export function createNavigationItem({
  id,
  title,
  route,
  icon,
  enabled,
  badge,
  priority,
  metadata,
  moduleId,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!route || typeof route !== "string") fail("route required.");
  if (!icon || typeof icon !== "string") fail("icon required.");
  if (enabled === undefined) fail("enabled required.");
  if (typeof priority !== "number") fail("priority required number.");
  if (!moduleId || typeof moduleId !== "string") fail("moduleId required.");

  const view = {
    id,
    title,
    route,
    icon,
    enabled: Boolean(enabled),
    badge: badge && typeof badge === "object" ? deepFreeze({ ...badge }) : deepFreeze({}),
    priority,
    moduleId,
    metadata: metadata && typeof metadata === "object" ? deepFreeze({ ...metadata }) : deepFreeze({}),
  };

  return deepFreeze(view);
}

