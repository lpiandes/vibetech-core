import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildAnalyticsView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("AnalyticsViewBuilder: workspaceConfig required.");
  }

  const enabled = Boolean(workspaceConfig.analyticsLayout?.enabled);

  return deepFreeze({
    id: "analytics_view",
    title: "Analytics",
    subtitle: "Readiness and performance snapshots",
    icon: "chart",
    badges: enabled ? [] : [{ id: "disabled", label: "Analytics disabled" }],
    actions: [{ id: "open_analytics", label: "Open analytics", type: "NAVIGATE", href: "/analytics" }],
    displayOrder: 80,
    visibility: enabled ? "VISIBLE" : "HIDDEN",
    status: "READY",
    enabled,
  });
}

