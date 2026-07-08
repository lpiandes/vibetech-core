export const ACTION_EXECUTION_STATUSES = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  SKIPPED: "SKIPPED",
};

function fail(message) {
  throw new Error(`AutomationActionExecutionResult: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createAutomationActionExecutionResult({
  actionId,
  actionType,
  status,
  startedAt,
  completedAt,
  output,
  error,
  metadata,
} = {}) {
  if (!actionId || typeof actionId !== "string") fail("actionId required.");
  if (!actionType || typeof actionType !== "string") fail("actionType required.");
  if (!Object.values(ACTION_EXECUTION_STATUSES).includes(String(status ?? ""))) {
    fail("status must be COMPLETED|FAILED|PENDING_APPROVAL|SKIPPED.");
  }
  if (!startedAt || typeof startedAt !== "string") fail("startedAt required.");

  const result = Object.freeze({
    actionId: String(actionId),
    actionType: String(actionType),
    status: String(status),
    startedAt: String(startedAt),
    completedAt: completedAt === undefined || completedAt === null ? null : String(completedAt),
    output: output === undefined || output === null ? null : isPlainObject(output) ? Object.freeze({ ...output }) : output,
    error: error === undefined || error === null ? null : String(error),
    metadata: metadata && isPlainObject(metadata) ? Object.freeze({ ...metadata }) : Object.freeze({}),
  });

  return result;
}
