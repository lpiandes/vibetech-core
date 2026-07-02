import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkAssignmentView: ${message}`);
}

export function createWorkAssignmentView({
  id,
  workItemId,
  assigneeId,
  assigneeName,
  assigneeType,
  assignedAt,
  status,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!workItemId || typeof workItemId !== "string") fail("workItemId required.");
  if (!assigneeId || typeof assigneeId !== "string") fail("assigneeId required.");
  if (!assigneeType || typeof assigneeType !== "string") fail("assigneeType required.");
  if (!assignedAt || typeof assignedAt !== "string") fail("assignedAt required.");
  if (!status || typeof status !== "string") fail("status required.");

  const view = {
    id,
    workItemId,
    assigneeId,
    assigneeName: String(assigneeName ?? ""),
    assigneeType,
    assignedAt,
    status,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

