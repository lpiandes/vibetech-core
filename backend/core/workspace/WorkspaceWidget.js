import { deepFreeze } from "./_utils/deepFreeze.js";
import { DEFAULT_WIDGET_TITLES } from "./WorkspaceDefaults.js";

export function createWorkspaceWidget(widgetId) {
  const title = DEFAULT_WIDGET_TITLES[widgetId]?.title ?? String(widgetId);
  return deepFreeze({
    id: String(widgetId),
    title,
    description: "",
    metadata: {},
  });
}

