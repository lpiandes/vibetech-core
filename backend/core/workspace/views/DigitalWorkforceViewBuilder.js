import { deepFreeze } from "../_utils/deepFreeze.js";
import { WorkspaceViewAdapter as RuntimeWorkspaceViewAdapter } from "../../views/WorkspaceViewAdapter.js";

function visibilityFromModule(workspaceConfig, moduleId) {
  return (workspaceConfig.modules ?? []).some((m) => m?.id === moduleId) ? "VISIBLE" : "HIDDEN";
}

export function buildDigitalWorkforceView({ workspaceConfig, runtime } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("DigitalWorkforceViewBuilder: workspaceConfig required.");
  }

  const moduleEnabled = (workspaceConfig.modules ?? []).some((m) => m?.id === "digital_workforce");

  if (!runtime) {
    return deepFreeze({
      id: "digital_workforce_view",
      title: "Digital Workforce",
      subtitle: "How is my Digital Workforce doing?",
      icon: "users",
      badges: [],
      actions: [],
      displayOrder: 60,
      visibility: moduleEnabled ? "VISIBLE" : "HIDDEN",
      status: "READY",

      // Contract-compatible fields consumed by existing frontend.
      workforceSummary: {
        workforceState: "Offline",
        employeesWorkingCount: 0,
        employeesNeedingReviewCount: 0,
        employeesOfflineCount: 0,
        todayTasksCompletedCount: 0,
        hoursSavedToday: 0,
        estimatedReviewTimeMinutes: 0,
      },
      employees: [],
    });
  }

  const runtimeAdapter = new RuntimeWorkspaceViewAdapter({ runtime });
  const runtimeView = runtimeAdapter.getDigitalWorkforceView();

  return deepFreeze({
    id: "digital_workforce_view",
    title: "Digital Workforce",
    subtitle: "How is my Digital Workforce doing?",
    icon: "users",
    badges: [],
    actions: [{ id: "open_workforce", label: "Open workforce", type: "NAVIGATE", href: "/digital-workforce" }],
    displayOrder: 60,
    visibility: moduleEnabled ? "VISIBLE" : "HIDDEN",
    status: "READY",

    workforceSummary: runtimeView.workforceSummary,
    employees: runtimeView.employees,
  });
}

