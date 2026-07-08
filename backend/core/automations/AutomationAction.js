import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const AUTOMATION_ACTION_TYPES = {
  CREATE_WORK: "CREATE_WORK",
  EXECUTE_EXTERNAL_ACTION: "EXECUTE_EXTERNAL_ACTION",
};

function fail(message) {
  throw new Error(`AutomationAction: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createAutomationAction({
  id,
  actionType,
  parameters,
  requiresApproval,
  order,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(actionType, "actionType");

  const at = String(actionType);
  if (!Object.values(AUTOMATION_ACTION_TYPES).includes(at)) fail(`unsupported actionType: ${at}`);

  if (!parameters || !isPlainObject(parameters)) fail("parameters must be plain object.");
  const p = deepFreeze(parameters);

  return deepFreeze({
    id: String(id),
    actionType: at,
    parameters: p,
    requiresApproval: Boolean(requiresApproval),
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
