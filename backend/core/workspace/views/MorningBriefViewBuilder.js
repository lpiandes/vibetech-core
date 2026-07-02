import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildMorningBriefView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("MorningBriefViewBuilder: workspaceConfig required.");
  }

  const cfg = workspaceConfig.morningBriefConfiguration ?? {};
  const enabled = Boolean(cfg.enabled);

  const view = deepFreeze({
    id: "morning_brief_view",
    title: "Morning Brief",
    subtitle: "Quiet-hours aware, governance friendly reminders",
    icon: "sun",
    badges: enabled ? [] : [{ id: "disabled", label: "Morning Brief disabled" }],
    actions: [{ id: "open_morning_brief", label: "Open brief", type: "NAVIGATE", href: "/morning-brief" }],
    displayOrder: 15,
    visibility: enabled ? "VISIBLE" : "HIDDEN",
    status: "READY",
    quietHours: cfg.quietHours ?? {},
    tone: cfg.tone ?? "Professional",
    enabled,
  });

  return view;
}

