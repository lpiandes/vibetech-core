import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { WORK_STATUSES } from "./WorkEventTypes.js";

function fail(message) {
  throw new Error(`WorkMetrics: ${message}`);
}

export function computeWorkMetrics({
  workItems,
  assignments,
  nowISO,
} = {}) {
  if (!Array.isArray(workItems)) fail("workItems must be array.");
  if (!Array.isArray(assignments)) fail("assignments must be array.");
  if (!nowISO || typeof nowISO !== "string") fail("nowISO must be ISO string.");

  const now = new Date(nowISO).getTime();
  if (!Number.isFinite(now)) fail("nowISO invalid date.");

  const totalWork = workItems.length;
  const completedWork = workItems.filter((w) => ["completed", "cancelled", "failed", "rejected"].includes(String(w.status))).length;
  const blockedWork = workItems.filter((w) => String(w.status) === "blocked").length;
  const reviewRequiredWork = workItems.filter((w) => String(w.status) === "review_required").length;

  const overdueWork = workItems.filter((w) => {
    const dueAt = w?.dueAt;
    if (!dueAt || typeof dueAt !== "string") return false;
    if (!["completed", "cancelled", "failed", "rejected"].includes(String(w.status))) {
      const t = new Date(dueAt).getTime();
      if (!Number.isFinite(t)) return false;
      return t < now;
    }
    return false;
  }).length;

  const assignedWork = new Set(
    assignments
      .filter((a) => String(a.status) === "active")
      .map((a) => String(a.workItemId)),
  ).size;

  const assignedWorkCount = assignedWork;
  const unassignedWork = Math.max(0, totalWork - assignedWorkCount);

  const openWork = workItems.filter((w) => !["completed", "cancelled", "failed", "rejected"].includes(String(w.status))).length;

  const metrics = {
    totalWork,
    openWork,
    completedWork,
    blockedWork,
    reviewRequiredWork,
    overdueWork,
    assignedWork: assignedWorkCount,
    unassignedWork,
  };

  return deepFreeze(metrics);
}

