import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamDepartment: ${message}`);
}

export function createTeamDepartment({ id, name, metadata } = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");

  const dept = {
    id,
    name,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(dept);
}

