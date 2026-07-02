import { ASSIGNMENT_STATUSES, UNASSIGNED_ASSIGNEE } from "./AssignmentDefaults.js";

function fail(message) {
  throw new Error(`AssignmentValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireRuntime(runtime, name) {
  if (!runtime || typeof runtime !== "object") fail(`${name} runtime required.`);
  if (typeof runtime.applyEvent !== "function") fail(`${name} runtime must expose applyEvent().`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function validateWorkCreatedEvent(event) {
  if (!event || typeof event !== "object") fail("event required.");
  if (String(event.eventType) !== "WORK_CREATED") fail("eventType must be WORK_CREATED.");
  if (!isPlainObject(event.payload)) fail("event.payload must be plain object.");
  return true;
}

export function validateRuntimes({ workRuntime, teamRuntime } = {}) {
  if (!workRuntime || typeof workRuntime !== "object") fail("workRuntime required.");
  if (!teamRuntime || typeof teamRuntime !== "object") fail("teamRuntime required.");
  if (typeof workRuntime.applyEvent !== "function") fail("workRuntime.applyEvent required.");
  if (typeof workRuntime.getWorkItem !== "function") fail("workRuntime.getWorkItem required.");
  if (typeof workRuntime.getAssignments !== "function") fail("workRuntime.getAssignments required.");
  if (typeof teamRuntime.getMembers !== "function") fail("teamRuntime.getMembers required.");
  return true;
}

export function validateAssignmentCandidate({ teamRuntime, candidate } = {}) {
  if (!teamRuntime) fail("teamRuntime required for candidate validation.");
  const members = teamRuntime.getMembers?.() ?? [];
  if (!Array.isArray(members) || members.length === 0) fail("teamRuntime members required.");

  // UNASSIGNED is always a valid candidate.
  if (!candidate) fail("candidate required.");
  if (candidate.assigneeType === UNASSIGNED_ASSIGNEE.type) return { ok: true };

  const found = members.find((m) => String(m.id) === String(candidate.assigneeId));
  if (!found) fail(`candidate assignee not found: ${safeString(candidate.assigneeId)}`);
  return { ok: true };
}

export function validateWorkItemExists({ workRuntime, workItemId } = {}) {
  const item = workRuntime.getWorkItem?.(workItemId);
  if (!item) fail(`work item not found: ${safeString(workItemId)}`);
  return item;
}

export function validateAssignmentResultShape(result) {
  if (!result || typeof result !== "object") fail("result required.");
  if (!Object.isFrozen(result)) fail("result must be frozen.");
  if (!Object.values(ASSIGNMENT_STATUSES).includes(String(result.status))) fail("invalid assignment status.");
  if (result.errors && !Array.isArray(result.errors)) fail("errors must be array.");
  return true;
}

