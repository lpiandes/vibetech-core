import { deepFreeze } from "../_utils/deepFreeze.js";

import { createNavigationItem } from "./NavigationItem.js";

function fail(message) {
  throw new Error(`NavigationGroup: ${message}`);
}

export function createNavigationGroup({
  title,
  description,
  icon,
  priority,
  items,
  metadata,
} = {}) {
  if (!title || typeof title !== "string") fail("title required.");
  if (!description || typeof description !== "string") fail("description required.");
  if (!icon || typeof icon !== "string") fail("icon required.");
  if (typeof priority !== "number") fail("priority required number.");

  const normalizedItems = Array.isArray(items) ? items : [];
  const itemViews = normalizedItems.map((it) =>
    createNavigationItem({
      ...it,
      badge: it.badge,
      metadata: it.metadata,
    }),
  );

  const group = {
    title,
    description,
    icon,
    priority,
    items: deepFreeze(itemViews),
    metadata: metadata && typeof metadata === "object" ? deepFreeze({ ...metadata }) : deepFreeze({}),
  };

  return deepFreeze(group);
}

