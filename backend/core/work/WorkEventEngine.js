import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  WORK_EVENT_TYPES,
  SUPPORTED_WORK_EVENT_TYPES,
} from "./WorkEventTypes.js";

import { createWorkItem } from "./WorkItem.js";
import { createWorkStage } from "./WorkStage.js";
import { createWorkQueue } from "./WorkQueue.js";
import { createWorkAssignment } from "./WorkAssignment.js";

import { computeWorkMetrics } from "./WorkMetrics.js";

import { WORK_ASSIGNMENT_STATUSES as ASSIGN_STATUS } from "./WorkAssignmentTypes.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`WorkEventEngine: expected ${name} to be a string.`);
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findById(items, id) {
  const sid = String(id);
  return items.find((x) => String(x?.id) === sid) ?? null;
}

export class WorkEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("WorkEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("WorkEventEngine: event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");

    if (!isPlainObject(event.payload)) throw new Error("WorkEventEngine: event.payload must be a plain object.");
    if (!SUPPORTED_WORK_EVENT_TYPES.includes(event.type)) throw new Error(`WorkEventEngine: Unsupported event type: ${event.type}`);

    const prev = this.runtime._state;
    let workItems = safeClone(prev.workItems);
    let stages = safeClone(prev.stages);
    let queues = safeClone(prev.queues);
    let assignments = safeClone(prev.assignments);

    const payload = event.payload;

    switch (event.type) {
      case WORK_EVENT_TYPES.WORK_ITEM_CREATED: {
        const { workItem } = payload;
        if (!isPlainObject(workItem)) throw new Error("WORK_ITEM_CREATED: workItem payload required.");
        const created = createWorkItem(workItem);
        if (workItems.some((w) => w.id === created.id)) throw new Error("WORK_ITEM_CREATED: workItem already exists.");
        workItems.push(created);

        const queue = findById(queues, created.queueId);
        if (queue && Array.isArray(queue.workItemIds)) {
          const qIdx = queues.findIndex((q) => q.id === queue.id);
          const nextIds = [...queue.workItemIds, created.id];
          queues[qIdx] = createWorkQueue({ ...queue, workItemIds: nextIds, metadata: queue.metadata });
        }
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_UPDATED: {
        const { workItemId, patch } = payload;
        requireString(workItemId, "payload.workItemId");
        if (!isPlainObject(patch)) throw new Error("WORK_ITEM_UPDATED: patch must be an object.");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_UPDATED: workItem does not exist.");

        const prevItem = workItems[idx];
        const prevQueueId = String(prevItem.queueId);

        const merged = {
          ...prevItem,
          ...patch,
          id: String(workItemId),
          updatedAt: event.timestampISO,
        };
        const updated = createWorkItem(merged);
        workItems[idx] = updated;

        const nextQueueId = String(updated.queueId);
        if (nextQueueId !== prevQueueId) {
          // Move from old queue to new queue.
          const prevQueue = findById(queues, prevQueueId);
          const nextQueue = findById(queues, nextQueueId);
          if (prevQueue && nextQueue) {
            const prevQIdx = queues.findIndex((q) => q.id === prevQueue.id);
            const nextQIdx = queues.findIndex((q) => q.id === nextQueue.id);
            const prevIds = (prevQueue.workItemIds ?? []).filter((id) => String(id) !== String(workItemId));
            const nextIds = [...(nextQueue.workItemIds ?? []), String(workItemId)];
            queues[prevQIdx] = createWorkQueue({ ...prevQueue, workItemIds: prevIds, metadata: prevQueue.metadata });
            queues[nextQIdx] = createWorkQueue({ ...nextQueue, workItemIds: nextIds, metadata: nextQueue.metadata });
          }
        }
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_STAGE_CHANGED: {
        const { workItemId, stageId } = payload;
        requireString(workItemId, "payload.workItemId");
        requireString(stageId, "payload.stageId");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_STAGE_CHANGED: workItem does not exist.");
        const stage = findById(stages, stageId);
        if (!stage) throw new Error("WORK_ITEM_STAGE_CHANGED: stageId does not exist.");

        const updated = createWorkItem({
          ...workItems[idx],
          stageId: String(stageId),
          updatedAt: event.timestampISO,
        });
        workItems[idx] = updated;
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_STATUS_CHANGED: {
        const { workItemId, status, completedAtISO } = payload;
        requireString(workItemId, "payload.workItemId");
        requireString(status, "payload.status");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_STATUS_CHANGED: workItem does not exist.");

        const isCompleted = String(status) === "completed";
        const merged = {
          ...workItems[idx],
          status: String(status),
          completedAt: isCompleted ? String(completedAtISO ?? event.timestampISO) : null,
          blockedReason: String(status) === "blocked" ? workItems[idx].blockedReason : null,
          updatedAt: event.timestampISO,
        };
        workItems[idx] = createWorkItem(merged);
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_ASSIGNED: {
        const { assignment } = payload;
        if (!isPlainObject(assignment)) throw new Error("WORK_ITEM_ASSIGNED: assignment payload required.");
        const created = createWorkAssignment(assignment);
        if (assignments.some((a) => a.id === created.id)) throw new Error("WORK_ITEM_ASSIGNED: assignment already exists.");

        const workItemIdx = workItems.findIndex((w) => String(w.id) === String(created.workItemId));
        if (workItemIdx === -1) throw new Error("WORK_ITEM_ASSIGNED: workItem does not exist.");

        // Add assignment and mark work as assigned to the assignee.
        assignments.push(created);
        const prevItem = workItems[workItemIdx];
        workItems[workItemIdx] = createWorkItem({
          ...prevItem,
          assignedTo: String(created.assigneeId),
          updatedAt: event.timestampISO,
        });
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_BLOCKED: {
        const { workItemId, blockedReason } = payload;
        requireString(workItemId, "payload.workItemId");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_BLOCKED: workItem does not exist.");
        const reason = String(blockedReason ?? prevBlockedReason(workItems[idx]));
        const updated = createWorkItem({
          ...workItems[idx],
          status: "blocked",
          blockedReason: reason,
          updatedAt: event.timestampISO,
        });
        workItems[idx] = updated;
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_UNBLOCKED: {
        const { workItemId, nextStatus } = payload;
        requireString(workItemId, "payload.workItemId");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_UNBLOCKED: workItem does not exist.");
        const merged = createWorkItem({
          ...workItems[idx],
          status: String(nextStatus ?? "ready"),
          blockedReason: null,
          updatedAt: event.timestampISO,
        });
        workItems[idx] = merged;
        break;
      }

      case WORK_EVENT_TYPES.WORK_ITEM_COMPLETED: {
        const { workItemId, completedAtISO } = payload;
        requireString(workItemId, "payload.workItemId");
        const idx = workItems.findIndex((w) => String(w.id) === String(workItemId));
        if (idx === -1) throw new Error("WORK_ITEM_COMPLETED: workItem does not exist.");

        const merged = createWorkItem({
          ...workItems[idx],
          status: "completed",
          completedAt: String(completedAtISO ?? event.timestampISO),
          blockedReason: null,
          updatedAt: event.timestampISO,
        });
        workItems[idx] = merged;

        // Mark active assignments for this work item as completed.
        assignments = assignments.map((a) => {
          if (String(a.workItemId) !== String(workItemId)) return a;
          if (String(a.status) !== "active") return a;
          return createWorkAssignment({
            ...a,
            status: ASSIGN_STATUS.COMPLETED,
          });
        });
        break;
      }

      case WORK_EVENT_TYPES.WORK_QUEUE_CREATED: {
        const { queue } = payload;
        if (!isPlainObject(queue)) throw new Error("WORK_QUEUE_CREATED: queue payload required.");
        const created = createWorkQueue(queue);
        if (queues.some((q) => q.id === created.id)) throw new Error("WORK_QUEUE_CREATED: queue already exists.");
        queues.push(created);
        break;
      }

      case WORK_EVENT_TYPES.WORK_STAGE_CREATED: {
        const { stage } = payload;
        if (!isPlainObject(stage)) throw new Error("WORK_STAGE_CREATED: stage payload required.");
        const created = createWorkStage(stage);
        if (stages.some((s) => s.id === created.id)) throw new Error("WORK_STAGE_CREATED: stage already exists.");
        stages.push(created);
        break;
      }

      default:
        throw new Error(`WorkEventEngine: Unhandled event type: ${event.type}`);
    }

    const metrics = computeWorkMetrics({
      workItems,
      assignments,
      nowISO: String(this.runtime.nowISO ?? "2026-07-01T00:00:00.000Z"),
    });

    const nextState = deepFreeze({
      ...prev,
      workItems,
      stages,
      queues,
      assignments,
      metrics,
    });

    this.runtime._state = nextState;
  }
}

function prevBlockedReason(workItem) {
  return String(workItem?.blockedReason ?? "blocked");
}

