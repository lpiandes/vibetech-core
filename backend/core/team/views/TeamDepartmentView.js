import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`TeamDepartmentView: ${message}`);
}

export function createTeamDepartmentView({
  id,
  name,
  summary,
  status,
  memberCount,
  activeCount,
  blockedCount,
  workload,
  members,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (!summary || typeof summary !== "string") fail("summary required.");

  const view = {
    id,
    name,
    summary,
    status: String(status ?? "open"),
    memberCount: Number(memberCount ?? 0),
    activeCount: Number(activeCount ?? 0),
    blockedCount: Number(blockedCount ?? 0),
    workload: deepFreeze(workload && typeof workload === "object" ? workload : {}),
    members: Array.isArray(members) ? deepFreeze(members) : deepFreeze([]),
    actions: Array.isArray(actions) ? deepFreeze(actions) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

