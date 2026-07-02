import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { WORK_STATUSES, WORK_EVENT_TYPES } from "./WorkEventTypes.js";
import { WORK_ASSIGNMENT_STATUSES } from "./WorkAssignmentTypes.js";

function fail(message) {
  throw new Error(`WorkRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    const id = String(item?.id ?? "");
    if (!id) fail(`${label} missing id`);
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateWorkRuntime(runtime) {
  const state = runtime?._state ?? runtime;
  if (!state || typeof state !== "object") fail("runtime state required.");
  if (!Object.isFrozen(state)) fail("work runtime state must be frozen.");

  const { workItems, stages, queues, assignments, metrics } = state;
  if (!Array.isArray(workItems)) fail("workItems must be array.");
  if (!Array.isArray(stages)) fail("stages must be array.");
  if (!Array.isArray(queues)) fail("queues must be array.");
  if (!Array.isArray(assignments)) fail("assignments must be array.");

  uniqueIds(workItems, "workItem");
  uniqueIds(stages, "stage");
  uniqueIds(queues, "queue");
  uniqueIds(assignments, "assignment");

  // Indexes for referential integrity.
  const stageIds = new Set(stages.map((s) => String(s.id)));
  const queueIds = new Set(queues.map((q) => String(q.id)));
  const workItemIds = new Set(workItems.map((w) => String(w.id)));

  // Validate work items.
  for (const w of workItems) {
    if (!WORK_STATUSES.includes(String(w.status))) fail(`invalid work status: ${String(w.status)}`);
    if (!stageIds.has(String(w.stageId))) fail(`workItem stageId missing stage: ${String(w.stageId)}`);
    if (!queueIds.has(String(w.queueId))) fail(`workItem queueId missing queue: ${String(w.queueId)}`);
    if (!w?.priority || typeof w.priority !== "string") fail("workItem priority must be string.");
    if (!w?.title || typeof w.title !== "string") fail("workItem title must be string.");
    if (!w?.dueAt || typeof w.dueAt !== "string") {
      // dueAt can be null only if explicitly set to null
      if (w?.dueAt !== null) fail("workItem dueAt must be ISO string or null.");
    }
    if (!w?.createdAt || typeof w.createdAt !== "string") fail("workItem createdAt must be string.");
    if (!w?.updatedAt || typeof w.updatedAt !== "string") fail("workItem updatedAt must be string.");
    if (w.completedAt !== null && w.completedAt !== undefined && typeof w.completedAt !== "string") {
      fail("workItem completedAt must be ISO string or null.");
    }
  }

  // Validate assignments.
  for (const a of assignments) {
    const st = String(a.status ?? "");
    if (!Object.values(WORK_ASSIGNMENT_STATUSES).includes(st)) fail(`invalid assignment status: ${st}`);
    if (!workItemIds.has(String(a.workItemId))) fail(`assignment workItemId missing work item: ${String(a.workItemId)}`);
    if (!a?.assigneeId || typeof a.assigneeId !== "string") fail("assignment assigneeId must be string.");
    if (!a?.assigneeType || typeof a.assigneeType !== "string") fail("assignment assigneeType must be string.");
    if (!a?.assignedAt || typeof a.assignedAt !== "string") fail("assignment assignedAt must be string.");
  }

  // Validate queues/workItemIds referential consistency (best-effort).
  for (const q of queues) {
    if (!Array.isArray(q.workItemIds)) fail(`queue.workItemIds must be array: ${String(q.id)}`);
    const ids = q.workItemIds.map((id) => String(id));
    const seen = new Set();
    for (const id of ids) {
      if (!workItemIds.has(id)) fail(`queue ${String(q.id)} references missing workItemId ${id}`);
      if (seen.has(id)) fail(`queue ${String(q.id)} has duplicate workItemId ${id}`);
      seen.add(id);
    }
  }

  // Metrics sanity.
  if (!metrics || typeof metrics !== "object") fail("metrics required.");
  for (const k of ["totalWork", "openWork", "completedWork", "blockedWork", "reviewRequiredWork", "overdueWork", "assignedWork", "unassignedWork"]) {
    if (typeof metrics[k] !== "number") fail(`metrics.${k} must be number`);
  }

  return { ok: true };
}

