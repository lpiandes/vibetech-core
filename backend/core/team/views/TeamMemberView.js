import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { TEAM_MEMBER_STATUS_BADGE } from "./TeamViewDefaults.js";

function fail(message) {
  throw new Error(`TeamMemberView: ${message}`);
}

export function createTeamMemberView({
  id,
  name,
  memberType,
  department,
  role,
  status,
  availability,
  workload,
  capacity,
  currentWork,
  attentionRequired,
  performanceSummary,
  badges,
  actions,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");
  if (!memberType || typeof memberType !== "string") fail("memberType required.");
  if (!department || typeof department !== "object") fail("department required.");
  if (!role || typeof role !== "object") fail("role required.");
  if (!status || typeof status !== "string") fail("status required.");

  const computedBadges =
    Array.isArray(badges) && badges.length > 0
      ? badges.map(String)
      : TEAM_MEMBER_STATUS_BADGE[String(status)] ? [TEAM_MEMBER_STATUS_BADGE[String(status)]] : [];

  const view = {
    id,
    name,
    memberType,
    department: deepFreeze({ id: String(department.id), name: String(department.name ?? "") }),
    role: deepFreeze({ id: String(role.id), name: String(role.name ?? "") }),
    status,
    availability: Number(availability ?? 0),
    workload: deepFreeze({
      assignedWork: Number(workload?.assignedWork ?? 0),
      pendingWork: Number(workload?.pendingWork ?? 0),
      completedWork: Number(workload?.completedWork ?? 0),
    }),
    capacity: Number(capacity ?? 0),
    currentWork: Array.isArray(currentWork) ? deepFreeze(currentWork) : deepFreeze([]),
    attentionRequired: Boolean(attentionRequired),
    performanceSummary: String(performanceSummary ?? ""),
    badges: deepFreeze(computedBadges),
    actions: Array.isArray(actions) ? deepFreeze(actions) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

