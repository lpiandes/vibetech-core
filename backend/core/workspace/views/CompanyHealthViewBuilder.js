import { deepFreeze } from "../_utils/deepFreeze.js";

export function buildCompanyHealthView({ workspaceConfig } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("CompanyHealthViewBuilder: workspaceConfig required.");
  }

  const enabled = (workspaceConfig.modules ?? []).some((m) => m?.id === "company_health");

  // This Sprint 2 configuration layer does not yet include full health metrics;
  // we still provide page-ready metadata and deterministic placeholders.
  const view = deepFreeze({
    id: "company_health_view",
    title: "Company Health",
    subtitle: "Governance visibility across capabilities",
    icon: "activity-health",
    badges: enabled ? [] : [{ id: "disabled", label: "Company Health disabled" }],
    actions: [{ id: "open_health", label: "Open health", type: "NAVIGATE", href: "/company-health" }],
    displayOrder: 40,
    visibility: enabled ? "VISIBLE" : "HIDDEN",
    status: "READY",
    healthOverview: {
      overallReadiness: workspaceConfig.dashboard?.layout ?? "IN_PROGRESS",
    },
  });

  return view;
}

