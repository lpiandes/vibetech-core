import { TEAM_MEMBER_STATUSES, isValidTeamMemberStatus } from "./TeamStatus.js";

function fail(message) {
  throw new Error(`TeamRuntimeValidator: ${message}`);
}

function isDeepFrozen(v) {
  return typeof v === "object" ? Object.isFrozen(v) : true;
}

function uniqueById(arr, label) {
  const seen = new Set();
  for (const x of arr) {
    const id = String(x?.id ?? "");
    if (!id) fail(`${label} entry missing id`);
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function isNumberFinite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function validateMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") fail("metrics required.");
  const fields = ["assignedWork", "completedWork", "pendingWork", "capacity", "utilization", "availability"];
  for (const f of fields) {
    if (!isNumberFinite(metrics[f])) fail(`metrics.${f} must be a number.`);
  }
  if (metrics.capacity < 0 || metrics.capacity > 1000000000) fail("metrics.capacity out of range.");
  if (metrics.utilization < 0 || metrics.utilization > 100) fail("metrics.utilization out of range.");
  if (metrics.availability < 0 || metrics.availability > 100) fail("metrics.availability out of range.");
}

export function validateTeamRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") fail("runtime required.");
  if (!runtime._state || typeof runtime._state !== "object") fail("runtime._state required.");
  if (!Object.isFrozen(runtime._state)) fail("runtime._state must be frozen.");

  const { members, departments, roles, status, metrics } = runtime._state;

  if (!Array.isArray(members) || !members.length) fail("members required.");
  if (!Array.isArray(departments) || !departments.length) fail("departments required.");
  if (!Array.isArray(roles) || !roles.length) fail("roles required.");

  uniqueById(members, "member");
  uniqueById(departments, "department");
  uniqueById(roles, "role");

  if (!isValidTeamMemberStatus(status)) fail(`invalid runtime status: ${status}`);
  if (!metrics || typeof metrics !== "object") fail("runtime.metrics required.");
  validateMetrics(metrics);

  // Members must be deep frozen objects.
  for (const m of members) {
    if (!isDeepFrozen(m)) fail("member must be frozen.");
    if (!isDeepFrozen(m.metrics)) fail("member.metrics must be frozen.");
    if (!m.id || typeof m.id !== "string") fail("member.id required.");
    if (!m.name || typeof m.name !== "string") fail("member.name required.");
    if (!["human", "digital_employee", "contractor", "vendor", "future"].includes(m.memberType)) fail(`invalid memberType: ${m.memberType}`);
    if (!isValidTeamMemberStatus(m.status)) fail(`invalid member status: ${m.status}`);
    if (typeof m.availability !== "number") fail("member.availability must be number.");
    if (m.workload && typeof m.workload !== "object") fail("member.workload must be object.");
    validateMetrics(m.metrics);
  }

  // Departments/roles deep frozen.
  for (const d of departments) {
    if (!isDeepFrozen(d)) fail("department must be frozen.");
    if (!d.id || typeof d.id !== "string") fail("department.id required.");
  }
  for (const r of roles) {
    if (!isDeepFrozen(r)) fail("role must be frozen.");
    if (!r.id || typeof r.id !== "string") fail("role.id required.");
  }

  return { ok: true };
}

