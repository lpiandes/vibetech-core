import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isOpenWork(w) {
  return !["completed", "cancelled", "closed"].includes(String(w?.status ?? ""));
}

function isOpenRequest(r) {
  return !["closed", "cancelled", "rejected"].includes(String(r?.status ?? ""));
}

function findWorkForRequest(ctx, requestId) {
  return safeArray(ctx?.workRuntime?.getWorkItems?.()).find((w) => String(w.requestId) === String(requestId));
}

/**
 * Universal operating-state counts — owner-facing decisions deduplicated.
 */
export function projectOperatingStates({ ctx, episodes, attentionItems, presentation, nowISO } = {}) {
  const requests = safeArray(ctx?.requestRuntime?.getRequests?.());
  const workItems = safeArray(ctx?.workRuntime?.getWorkItems?.());
  const runs = safeArray(ctx?.automationRuntime?.getRuns?.());

  const inboundNew = requests.filter((r) => r.inboundAttribution && isOpenRequest(r) && !findWorkForRequest(ctx, r.id)).length;
  const waitingHuman = safeArray(attentionItems).length;
  const movingForward = workItems.filter((w) => isOpenWork(w) && w.status !== "blocked" && w.status !== "waiting").length;
  const completedToday = workItems.filter((w) => w.status === "completed").length;
  const vibeTechHandling = safeArray(episodes).filter((e) => e.operatingState === "handling").length;
  const newEpisodes = safeArray(episodes).filter((e) => e.operatingState === "new" || (!e.workId && isOpenRequest(ctx?.requestRuntime?.getRequest?.(e.requestId)))).length;

  const labels = presentation?.operatingStateLabels ?? {};

  const states = [
    { id: "new", label: labels.new ?? "New", count: Math.max(inboundNew, newEpisodes), episodeFilter: "new" },
    { id: "vibetech_handling", label: labels.vibetechHandling ?? "VIBETech handling", count: vibeTechHandling, episodeFilter: "vibetech_handling" },
    { id: "waiting_human", label: labels.waitingHuman ?? "Waiting on you", count: waitingHuman, episodeFilter: "waiting_human" },
    { id: "moving_forward", label: labels.movingForward ?? "Moving forward", count: movingForward, episodeFilter: "moving_forward" },
    { id: "completed", label: labels.completed ?? "Completed", count: completedToday, episodeFilter: "completed" },
  ];

  const atRisk = workItems.filter((w) => w.overdue || w.status === "blocked").length;

  void runs;
  void nowISO;

  return deepFreeze({
    states: deepFreeze(states),
    atRisk,
  });
}
