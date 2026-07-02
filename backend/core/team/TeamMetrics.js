import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamMetrics: ${message}`);
}

function clampInt(n, min, max) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function createTeamMetrics({
  assignedWork,
  completedWork,
  pendingWork,
  capacity,
  utilization,
  availability,
  metadata,
} = {}) {
  const tm = {
    assignedWork: clampInt(assignedWork ?? 0, 0, 1000000000),
    completedWork: clampInt(completedWork ?? 0, 0, 1000000000),
    pendingWork: clampInt(pendingWork ?? 0, 0, 1000000000),
    capacity: clampInt(capacity ?? 0, 0, 1000000000),
    utilization: clampInt(utilization ?? 0, 0, 100),
    availability: clampInt(availability ?? 0, 0, 100),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  if (tm.capacity < 0) fail("capacity invalid.");
  return deepFreeze(tm);
}

