import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`WorkStage: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
}

export function createWorkStage({
  id,
  name,
  description,
  status,
  sortOrder,
  requirements,
  exitCriteria,
  metadata,
} = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(description, "description");
  requireString(status, "status");

  const so = typeof sortOrder === "number" && Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0;

  const view = {
    id,
    name,
    description,
    status,
    sortOrder: so,
    requirements: Array.isArray(requirements) ? deepFreeze(requirements) : deepFreeze([]),
    exitCriteria: Array.isArray(exitCriteria) ? deepFreeze(exitCriteria) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

