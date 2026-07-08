export const CLOSED_WORK_STATUSES = new Set(["completed", "cancelled", "closed", "failed", "rejected"]);

export type WorkQueueItem = {
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  dueAt?: string | null;
  metadata?: {
    display?: {
      overdue?: boolean;
      partyName?: string | null;
      subjectId?: string | null;
      subjectName?: string | null;
      engagementHref?: string | null;
      personHref?: string | null;
      propertyHref?: string | null;
      rowHref?: string | null;
      workTypeLabel?: string;
      statusLabel?: string;
      dueLabel?: string | null;
      nextStep?: string;
      assigneeName?: string | null;
    };
  };
};

export type WorkQueueFilter = "all" | "open" | "blocked" | "overdue";

export type WorkQueueMetrics = {
  openWork?: number;
  blockedWork?: number;
  overdueWork?: number;
};

function normalizeStatus(status: unknown) {
  return String(status ?? "").toLowerCase();
}

export function isActiveWorkItem(item: WorkQueueItem) {
  return !CLOSED_WORK_STATUSES.has(normalizeStatus(item?.status));
}

export function isBlockedWorkItem(item: WorkQueueItem) {
  return normalizeStatus(item?.status) === "blocked";
}

export function isWaitingWorkItem(item: WorkQueueItem) {
  return normalizeStatus(item?.status) === "waiting";
}

/** Matches WorkMetrics.overdueWork: due in the past for non-terminal statuses. */
export function isOverdueWorkItem(item: WorkQueueItem, nowISO?: string) {
  if (!isActiveWorkItem(item)) return false;

  const displayOverdue = item?.metadata?.display?.overdue;
  if (typeof displayOverdue === "boolean") return displayOverdue;

  const dueAt = item?.dueAt;
  if (!dueAt || typeof dueAt !== "string") return false;
  const dueMs = new Date(dueAt).getTime();
  if (!Number.isFinite(dueMs)) return false;
  const nowMs = nowISO ? new Date(nowISO).getTime() : Date.now();
  if (!Number.isFinite(nowMs)) return false;
  return dueMs < nowMs;
}

export function getActiveWorkItems(items: unknown) {
  return (Array.isArray(items) ? items : []).filter(isActiveWorkItem) as WorkQueueItem[];
}

export function countWaitingWork(items: unknown) {
  return getActiveWorkItems(items).filter(isWaitingWorkItem).length;
}

export function filterWorkItems(items: unknown, filter: WorkQueueFilter) {
  const active = getActiveWorkItems(items);
  switch (filter) {
    case "blocked":
      return active.filter(isBlockedWorkItem);
    case "overdue":
      return active.filter((item) => isOverdueWorkItem(item));
    case "open":
    case "all":
    default:
      return active;
  }
}

export function deriveWorkQueueCounts(items: unknown, metrics: WorkQueueMetrics = {}) {
  const active = getActiveWorkItems(items);
  return {
    all: active.length,
    open: Number(metrics.openWork ?? active.length),
    blocked: Number(metrics.blockedWork ?? active.filter(isBlockedWorkItem).length),
    overdue: Number(metrics.overdueWork ?? active.filter((item) => isOverdueWorkItem(item)).length),
    waiting: countWaitingWork(items),
  };
}

export function sortWorkQueueItems(items: WorkQueueItem[]) {
  const priorityRank: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, normal: 3, low: 4 };

  return items.slice().sort((a, b) => {
    const aOverdue = isOverdueWorkItem(a) ? 0 : 1;
    const bOverdue = isOverdueWorkItem(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    const aBlocked = isBlockedWorkItem(a) ? 0 : 1;
    const bBlocked = isBlockedWorkItem(b) ? 0 : 1;
    if (aBlocked !== bBlocked) return aBlocked - bBlocked;

    const pa = priorityRank[String(a.priority ?? "normal")] ?? 3;
    const pb = priorityRank[String(b.priority ?? "normal")] ?? 3;
    return pa - pb;
  });
}

export function resolveWorkRowHref(
  display: NonNullable<WorkQueueItem["metadata"]>["display"] | undefined,
  businessId: string,
) {
  if (!display) return null;
  const bid = String(businessId ?? "");
  if (display.rowHref) return String(display.rowHref);
  if (display.personHref && bid) return String(display.personHref);
  if (display.subjectId && bid) return `/b/${bid}/properties/${display.subjectId}`;
  if (bid) return null;
  if (display.engagementHref) return String(display.engagementHref);
  return null;
}

export function priorityLabel(priority: unknown) {
  const key = String(priority ?? "").trim();
  if (!key || key === "normal" || key === "medium") return null;
  return key.replace(/_/g, " ");
}

export function priorityTone(priority: unknown): "warning" | "info" | "neutral" {
  const key = String(priority ?? "").toLowerCase();
  if (key === "critical" || key === "urgent" || key === "high") return "warning";
  if (key === "low") return "info";
  return "neutral";
}

export function statusTone(item: WorkQueueItem): "warning" | "info" | "success" | "neutral" {
  if (isOverdueWorkItem(item)) return "warning";
  const status = normalizeStatus(item.status);
  if (status === "blocked" || status === "review_required") return "warning";
  if (status === "in_progress" || status === "waiting") return "info";
  if (status === "completed") return "success";
  return "neutral";
}
