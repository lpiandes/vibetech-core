import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkQueue: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

export function createWorkQueue({
  id,
  name,
  description,
  type,
  priority,
  workItemIds,
  owner,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(description, "description");
  requireString(type, "type");
  requireString(priority, "priority");
  requireString(owner, "owner");

  const ids = Array.isArray(workItemIds) ? workItemIds.map(String) : [];

  const view = {
    id,
    name,
    description,
    type,
    priority,
    workItemIds: deepFreeze(ids),
    owner,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

