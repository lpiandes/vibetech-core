import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildNotificationsView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("NotificationsViewBuilder: workspaceConfig required.");
  }

  const cfg = workspaceConfig.notifications ?? {};
  const enabled = Boolean(cfg.enabled);

  return deepFreeze({
    id: "notifications_view",
    title: "Notifications",
    subtitle: "Quiet-hours governed outbound readiness cues",
    icon: "bell",
    badges: enabled ? [] : [{ id: "disabled", label: "Notifications disabled" }],
    actions: [],
    displayOrder: 16,
    visibility: enabled ? "VISIBLE" : "HIDDEN",
    status: "READY",
    enabled,
    quietHours: cfg.quietHours ?? {},
    channels: Array.isArray(cfg.channels) ? cfg.channels : ["EMAIL"],
  });
}

