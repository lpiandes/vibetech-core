import { deepFreeze } from "../_utils/deepFreeze.js";
import { WorkspaceViewAdapter as RuntimeWorkspaceViewAdapter } from "../../views/WorkspaceViewAdapter.js";

function visibilityFromModule(workspaceConfig, moduleId) {
  return (workspaceConfig.modules ?? []).some((m) => m?.id === moduleId) ? "VISIBLE" : "HIDDEN";
}

export function buildQueueView({ workspaceConfig, runtime } = {}) {
  if (!workspaceConfig || typeof workspaceConfig !== "object") {
    throw new Error("QueueViewBuilder: workspaceConfig required.");
  }

  const workQueueModuleEnabled = (workspaceConfig.modules ?? []).some((m) => m?.id === "work_queue");
  const deterministicNowISO =
    workspaceConfig?.metadata?.generatedAt ??
    workspaceConfig?.metadata?.generatedAtISO ??
    "1970-01-01T00:00:00.000Z";

  if (!runtime) {
    return deepFreeze({
      id: "work_queue_view",
      title: "Work Queue",
      subtitle: "Triage and progress for reviewable work",
      icon: "inbox",
      badges: [],
      actions: [],
      displayOrder: 50,
      visibility: workQueueModuleEnabled ? "VISIBLE" : "HIDDEN",
      status: "READY",

      reviewQueueState: "Offline",
      items: [],
      summary: { itemsNeedingReview: 0 },
      metadata: { lastUpdatedISO: deterministicNowISO },
    });
  }

  // Preserve existing frontend queue contract by enriching with runtime data.
  const runtimeAdapter = new RuntimeWorkspaceViewAdapter({ runtime });
  const runtimeQueue = runtimeAdapter.getWorkQueueView();

  // Ensure items have the field name used by the existing UI component.
  const items = Array.isArray(runtimeQueue.items)
    ? runtimeQueue.items.map((it) => ({
        // Contract fields used by queue card rendering.
        id: it.id,
        title: it.title,
        clientName: it.clientName,
        matterType: it.matterType,
        priority: it.priority,
        status: it.status,
        employee: it.assignedEmployeeName ?? it.employee ?? "",
        assignedEmployeeName: it.assignedEmployeeName ?? it.employee ?? "",
        createdTimeISO: it.createdTimeISO,
      }))
    : [];

  const view = deepFreeze({
    id: "work_queue_view",
    title: "Work Queue",
    subtitle: "Why is this waiting for your review?",
    icon: "inbox",
    badges: [],
    actions: [{ id: "open_queue", label: "Open queue", type: "NAVIGATE", href: "/work-queue" }],
    displayOrder: 50,
    visibility: workQueueModuleEnabled ? "VISIBLE" : "HIDDEN",
    status: "READY",

    // Contract-compatible fields consumed by existing Work Queue page/component.
    reviewQueueState: runtimeQueue.reviewQueueState,
    items,
    summary: runtimeQueue.summary ?? { itemsNeedingReview: 0 },
    metadata: runtimeQueue.metadata ?? { lastUpdatedISO: new Date().toISOString() },
  });

  return view;
}

