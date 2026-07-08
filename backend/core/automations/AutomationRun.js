import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const AUTOMATION_RUN_STATUSES = {
  RUNNING: "RUNNING",
  WAITING_FOR_APPROVAL: "WAITING_FOR_APPROVAL",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CLOSED: "CLOSED",
};

function fail(message) {
  throw new Error(`AutomationRun: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function requirePlainObject(v, name) {
  const ok = Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!ok) fail(`${name} required plain object.`);
  return v;
}

export function createAutomationRun({
  id,
  automationId,
  triggerEventId,
  triggerEventType,
  status,
  matchedConditions,
  plannedActions,
  executionResults,
  startedAt,
  completedAt,
  error,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(automationId, "automationId");
  requireString(triggerEventId, "triggerEventId");
  requireString(triggerEventType, "triggerEventType");

  if (!Object.values(AUTOMATION_RUN_STATUSES).includes(String(status ?? ""))) {
    fail("status must be RUNNING|WAITING_FOR_APPROVAL|COMPLETED|FAILED|CLOSED.");
  }

  if (!Array.isArray(matchedConditions)) fail("matchedConditions must be array.");
  if (!Array.isArray(plannedActions)) fail("plannedActions must be array.");
  if (!Array.isArray(executionResults)) fail("executionResults must be array.");

  const started = startedAt ? String(startedAt) : "2026-07-01T00:00:00.000Z";
  const completed = completedAt === undefined ? null : completedAt === null ? null : String(completedAt);

  const err = error === undefined ? null : error === null ? null : String(error);

  return deepFreeze({
    id: String(id),
    automationId: String(automationId),
    triggerEventId: String(triggerEventId),
    triggerEventType: String(triggerEventType),
    status: String(status),
    matchedConditions: deepFreeze(matchedConditions),
    plannedActions: deepFreeze(plannedActions),
    executionResults: deepFreeze(executionResults),
    startedAt: started,
    completedAt: completed,
    error: err,
    metadata: requirePlainObject(metadata ?? {}, "metadata"),
  });
}
