import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamWorkloadView: ${message}`);
}

export function createTeamWorkloadView({
  totalMembers,
  activeMembers,
  blockedMembers,
  availableMembers,
  busyMembers,
  offlineMembers,
  totalAssignedWork,
  totalPendingWork,
  totalCompletedWork,
  utilization,
  metadata,
} = {}) {
  if (typeof totalMembers !== "number") fail("totalMembers required.");
  if (typeof utilization !== "number") fail("utilization required.");

  const v = {
    totalMembers,
    activeMembers,
    blockedMembers,
    availableMembers,
    busyMembers,
    offlineMembers,
    totalAssignedWork,
    totalPendingWork,
    totalCompletedWork,
    utilization,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(v);
}

