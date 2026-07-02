import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkItemView: ${message}`);
}

export function createWorkItemView({
  id,
  title,
  description,
  workType,
  status,
  priority,
  stage,
  queue,
  assignedTo,
  owner,
  dueAt,
  age,
  blockedReason,
  attentionRequired,
  nextAction,
  relatedObjects,
  badges,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!description || typeof description !== "string") fail("description required.");
  if (!workType || typeof workType !== "string") fail("workType required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!priority || typeof priority !== "string") fail("priority required.");

  if (!stage || typeof stage !== "object") fail("stage required.");
  if (!queue || typeof queue !== "object") fail("queue required.");

  const view = {
    id,
    title,
    description,
    workType,
    status,
    priority,
    stage: deepFreeze({ id: String(stage.id), name: String(stage.name ?? "") }),
    queue: deepFreeze({ id: String(queue.id), name: String(queue.name ?? "") }),
    assignedTo: String(assignedTo ?? "unassigned"),
    owner: String(owner ?? ""),
    dueAt: dueAt === undefined ? null : dueAt,
    age: age === undefined ? "" : String(age),
    blockedReason: blockedReason === undefined ? null : blockedReason,
    attentionRequired: Boolean(attentionRequired),
    nextAction: nextAction === undefined ? null : nextAction,
    relatedObjects: Array.isArray(relatedObjects) ? deepFreeze(relatedObjects) : deepFreeze([]),
    badges: Array.isArray(badges) ? deepFreeze(badges.map(String)) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

