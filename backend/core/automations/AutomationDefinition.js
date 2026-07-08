import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { AUTOMATION_DEFINITION_STATUSES } from "./AutomationEventTypes.js";

function fail(message) {
  throw new Error(`AutomationDefinition: ${message}`);
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

export function createAutomationDefinition({
  id,
  name,
  description,
  status,
  trigger,
  conditions,
  actions,
  priority,
  version,
  metadata,
  createdAt,
  updatedAt,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requirePlainObject(trigger, "trigger");
  if (!Object.values(AUTOMATION_DEFINITION_STATUSES).includes(String(status ?? ""))) fail(`status must be ACTIVE|INACTIVE|ARCHIVED.`);
  if (!Array.isArray(conditions)) fail("conditions must be array.");
  if (!Array.isArray(actions)) fail("actions must be array.");

  return deepFreeze({
    id: String(id),
    name: String(name),
    description: description === undefined ? "" : String(description),
    status: String(status),
    trigger,
    conditions: deepFreeze(conditions),
    actions: deepFreeze(actions),
    priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
    version: Number.isFinite(Number(version)) ? Number(version) : 1,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
    createdAt: createdAt === undefined ? "2026-07-01T00:00:00.000Z" : String(createdAt),
    updatedAt: updatedAt === undefined ? "2026-07-01T00:00:00.000Z" : String(updatedAt),
  });
}
