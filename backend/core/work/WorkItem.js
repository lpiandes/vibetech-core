import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { WORK_STATUSES } from "./WorkEventTypes.js";

function fail(message) {
  throw new Error(`WorkItem: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

function requireISOorNull(v, name) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") fail(`${name} must be ISO string or null.`);
  return v;
}

export function createWorkItem({
  id,
  title,
  description,
  workType,
  status,
  priority,
  stageId,
  queueId,
  assignedTo,
  requestedBy,
  source,
  dueAt,
  createdAt,
  updatedAt,
  completedAt,
  blockedReason,
  relatedObjects,
  requirements,
  metadata,
  outcomeSummary = null,
  memoryChanges = null,
} = {}) {
  requireString(id, "id");
  requireString(title, "title");
  requireString(description, "description");
  requireString(workType, "workType");
  requireString(status, "status");
  if (!WORK_STATUSES.includes(status)) fail(`invalid status: ${status}`);
  requireString(priority, "priority");
  requireString(stageId, "stageId");
  requireString(queueId, "queueId");
  requireString(assignedTo, "assignedTo");
  requireString(requestedBy, "requestedBy");
  requireString(source, "source");
  requireString(createdAt, "createdAt");
  requireString(updatedAt, "updatedAt");

  const changes = Array.isArray(memoryChanges)
    ? memoryChanges.map((entry) => String(entry)).filter(Boolean)
    : [];

  const workItem = {
    id,
    title,
    description,
    workType,
    status,
    priority,
    stageId,
    queueId,
    assignedTo,
    requestedBy,
    source,
    dueAt: requireISOorNull(dueAt, "dueAt"),
    createdAt,
    updatedAt,
    completedAt: requireISOorNull(completedAt, "completedAt"),
    blockedReason: blockedReason === undefined ? null : blockedReason,
    relatedObjects: Array.isArray(relatedObjects) ? relatedObjects : [],
    requirements: Array.isArray(requirements) ? requirements : [],
    outcomeSummary:
      outcomeSummary == null || outcomeSummary === undefined
        ? null
        : String(outcomeSummary).trim() || null,
    memoryChanges: deepFreeze(changes),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(workItem);
}

