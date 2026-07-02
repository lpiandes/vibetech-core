import { deepFreeze } from "../_utils/deepFreeze.js";
import { WorkspaceViewAdapter as RuntimeWorkspaceViewAdapter } from "../../views/WorkspaceViewAdapter.js";

function iconForModuleKind(kind) {
  switch (kind) {
    case "health":
      return "activity-health";
    case "recommendations":
    case "recommendationsModule":
      return "sparkles";
    case "workforce":
      return "users";
    case "queue":
      return "inbox";
    case "analytics":
      return "chart";
    case "knowledge":
      return "book";
    default:
      return "dashboard";
  }
}

export function buildDashboardView({ workspaceConfig, runtime } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("DashboardViewBuilder: workspaceConfig required.");
  }
  if (!runtime) {
    // Deterministic placeholder: config-only mode.
    return deepFreeze({
      id: "dashboard_view",
      title: "Dashboard",
      subtitle: "Workspace overview",
      icon: "dashboard",
      badges: [],
      actions: [],
      displayOrder: 10,
      visibility: workspaceConfig.modules?.some((m) => m?.id === "dashboard") ? "VISIBLE" : "HIDDEN",
      status: "READY",
      greeting: "Good morning.",
      completedTasksWhileAway: 0,
      itemsRequiringReview: 0,
      estimatedReviewTimeMinutes: 0,
      impactMetrics: {
        hoursSaved: 0,
        draftsCreatedToday: 0,
        pendingReviews: 0,
        estimatedValueCreatedK: 0,
      },
      digitalWorkforceCard: {
        employeeName: "",
        status: "Offline",
        todayActivitySummary: "No activity yet.",
      },
      recentActivity: [],
      activityFeed: [],
      company: undefined,
    });
  }

  const runtimeAdapter = new RuntimeWorkspaceViewAdapter({ runtime });
  const runtimeDashboard = runtimeAdapter.getDashboardView();
  const dashboardModuleEnabled = (workspaceConfig.modules ?? []).some((m) => m?.id === "dashboard");

  const kind = (workspaceConfig.modules ?? []).find((m) => m?.id === "dashboard")?.metadata?.kind;

  const view = {
    id: "dashboard_view",
    title: "Dashboard",
    subtitle: "What your Digital Workforce needs today",
    icon: iconForModuleKind(kind),
    badges: [],
    actions: [
      { id: "open_review_queue", label: "Review buyer response", type: "NAVIGATE", href: "/work-queue" },
    ],
    displayOrder: 10,
    visibility: dashboardModuleEnabled ? "VISIBLE" : "HIDDEN",
    status: "READY",

    // Contract-compatible fields consumed by existing Dashboard components.
    greeting: runtimeDashboard.greeting,
    completedTasksWhileAway: runtimeDashboard.completedTasksWhileAway,
    itemsRequiringReview: runtimeDashboard.itemsRequiringReview,
    estimatedReviewTimeMinutes: runtimeDashboard.estimatedReviewTimeMinutes,
    impactMetrics: runtimeDashboard.impactMetrics,
    digitalWorkforceCard: runtimeDashboard.digitalWorkforceCard,
    recentActivity: runtimeDashboard.recentActivity,
    activityFeed: runtimeDashboard.activityFeed,
    company: runtimeDashboard.company,
  };

  return deepFreeze(view);
}

