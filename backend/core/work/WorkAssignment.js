import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { WORK_ASSIGNMENT_STATUSES } from "./WorkAssignmentTypes.js";

function fail(message) {
  throw new Error(`WorkAssignment: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

export function createWorkAssignment({
  id,
  workItemId,
  assigneeId,
  assigneeType,
  assignedAt,
  assignedBy,
  status,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(workItemId, "workItemId");
  requireString(assigneeId, "assigneeId");
  requireString(assigneeType, "assigneeType");
  requireString(assignedAt, "assignedAt");
  requireString(assignedBy, "assignedBy");
  requireString(status, "status");

  if (!Object.values(WORK_ASSIGNMENT_STATUSES).includes(status)) fail(`invalid assignment status: ${status}`);

  const view = {
    id,
    workItemId,
    assigneeId,
    assigneeType,
    assignedAt,
    assignedBy,
    status,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

