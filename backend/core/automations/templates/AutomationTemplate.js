import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AutomationTemplate: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

export const AUTOMATION_TEMPLATE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
};

export function createAutomationTemplate({
  id,
  name,
  description,
  status = AUTOMATION_TEMPLATE_STATUS.ACTIVE,
  version = 1,
  trigger,
  conditions,
  actions,
  requiredCapabilities,
  requiredConnectedSystems,
  requiredConfiguration,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(description ?? "", "description");
  if (!Object.values(AUTOMATION_TEMPLATE_STATUS).includes(String(status))) {
    fail(`status must be ACTIVE|INACTIVE|ARCHIVED`);
  }
  if (!isPlainObject(trigger)) fail("trigger required plain object.");
  if (!Array.isArray(conditions)) fail("conditions required array.");
  if (!Array.isArray(actions)) fail("actions required array.");
  if (requiredConfiguration !== undefined && !Array.isArray(requiredConfiguration)) fail("requiredConfiguration must be array.");

  return deepFreeze({
    id: String(id),
    name: String(name),
    description: String(description),
    status: String(status),
    version: Number.isFinite(Number(version)) ? Number(version) : 1,
    trigger: deepFreeze(trigger),
    conditions: deepFreeze(conditions),
    actions: deepFreeze(actions),
    requiredCapabilities: Array.isArray(requiredCapabilities) ? deepFreeze(requiredCapabilities.map(String)) : deepFreeze([]),
    requiredConnectedSystems: Array.isArray(requiredConnectedSystems)
      ? deepFreeze(requiredConnectedSystems.map(String))
      : deepFreeze([]),
    requiredConfiguration: Array.isArray(requiredConfiguration) ? deepFreeze(requiredConfiguration) : deepFreeze([]),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
