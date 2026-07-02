import { deepFreeze } from "./_utils/deepFreeze.js";

export function buildWorkspaceDashboard({ modules, widgets, capabilitySummary } = {}) {
  const selectedWidgetIds = Array.isArray(widgets) ? widgets : [];
  const layout = capabilitySummary?.overallReadiness ?? "IN_PROGRESS";

  return deepFreeze({
    defaultWidgets: selectedWidgetIds.map((id) => String(id)),
    layout,
    sections: [
      { id: "primary", title: "Primary", widgetIds: selectedWidgetIds },
    ],
    cards: [],
    summary: "Deterministic workspace dashboard.",
    priorityOrdering: "deterministic",
  });
}

