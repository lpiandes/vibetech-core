import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { TEAM_MEMBER_STATUSES, isValidTeamMemberStatus } from "./TeamStatus.js";

const MEMBER_TYPES = ["human", "digital_employee", "contractor", "vendor", "future"];

function fail(message) {
  throw new Error(`TeamMember: ${message}`);
}

function clampInt(n, min, max) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  const c = Math.max(min, Math.min(max, Math.round(v)));
  return c;
}

function normalizeMemberType(type) {
  const t = String(type ?? "");
  if (!MEMBER_TYPES.includes(t)) return "human";
  return t;
}

export function createTeamMember({
  id,
  name,
  memberType,
  departmentId,
  roleId,
  status,
  availability,
  workload,
  capacity,
  skills,
  permissions,
  metrics,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!name || typeof name !== "string") fail("name required.");

  const mt = normalizeMemberType(memberType);

  if (!departmentId || typeof departmentId !== "string") fail("departmentId required.");
  if (!roleId || typeof roleId !== "string") fail("roleId required.");

  const st = String(status ?? "available");
  if (!isValidTeamMemberStatus(st)) fail(`invalid status: ${st}`);

  const av = clampInt(availability ?? 0, 0, 100);
  const cap = clampInt(capacity ?? 0, 0, 100);

  const w = workload && typeof workload === "object" ? workload : {};
  const assignedWork = clampInt(w.assignedWork ?? 0, 0, 1000000);
  const completedWork = clampInt(w.completedWork ?? 0, 0, 1000000);
  const pendingWork = clampInt(w.pendingWork ?? 0, 0, 1000000);

  const m = metrics && typeof metrics === "object" ? metrics : {};
  const metricsCapacity = clampInt(m.capacity ?? cap, 0, 100);
  const utilization = clampInt(m.utilization ?? (cap > 0 ? (assignedWork / cap) * 100 : 0), 0, 100);
  const metricsAvailability = clampInt(m.availability ?? (100 - utilization), 0, 100);
  const metricsAssignedWork = clampInt(m.assignedWork ?? assignedWork, 0, 1000000);
  const metricsCompletedWork = clampInt(m.completedWork ?? completedWork, 0, 1000000);
  const metricsPendingWork = clampInt(m.pendingWork ?? pendingWork, 0, 1000000);

  const member = {
    id,
    name,
    memberType: mt,
    departmentId,
    roleId,
    status: st,
    availability: av,
    workload: deepFreeze({
      assignedWork,
      completedWork,
      pendingWork,
    }),
    capacity: cap,
    skills: Array.isArray(skills) ? skills.map(String) : [],
    permissions: Array.isArray(permissions) ? permissions.map(String) : [],
    metrics: deepFreeze({
      assignedWork: metricsAssignedWork,
      completedWork: metricsCompletedWork,
      pendingWork: metricsPendingWork,
      capacity: metricsCapacity,
      utilization,
      availability: metricsAvailability,
    }),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(member);
}

