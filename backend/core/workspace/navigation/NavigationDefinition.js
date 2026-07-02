import { deepFreeze } from "../_utils/deepFreeze.js";

import { createNavigationGroup } from "./NavigationGroup.js";

export function createNavigationDefinition({ groups, metadata } = {}) {
  const normalizedGroups = Array.isArray(groups) ? groups : [];
  const views = normalizedGroups.map((g) => createNavigationGroup(g));

  return deepFreeze({
    id: "navigation_definition",
    version: "1",
    metadata: metadata && typeof metadata === "object" ? deepFreeze({ ...metadata }) : deepFreeze({}),
    groups: deepFreeze(views),
  });
}

