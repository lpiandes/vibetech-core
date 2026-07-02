import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";

function fail(message) {
  throw new Error(`WorkCreationValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireNullableString(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(`${name} must be string or null.`);
  return value;
}

function validateWorkItemInput(workItemInput) {
  if (!isPlainObject(workItemInput)) fail("workItemInput must be plain object.");

  for (const k of [
    "id",
    "title",
    "description",
    "workType",
    "status",
    "priority",
    "stageId",
    "queueId",
    "assignedTo",
    "requestedBy",
    "source",
    "createdAt",
    "updatedAt",
  ]) {
    requireString(workItemInput[k], `workItemInput.${k}`);
  }

  requireNullableString(workItemInput.dueAt, "workItemInput.dueAt");
  requireNullableString(workItemInput.completedAt, "workItemInput.completedAt");
  // blockedReason is optional in WorkItem but treat null as allowed.
  requireNullableString(workItemInput.blockedReason, "workItemInput.blockedReason");

  if (!Array.isArray(workItemInput.relatedObjects)) fail("workItemInput.relatedObjects must be array.");
  if (!Array.isArray(workItemInput.requirements)) fail("workItemInput.requirements must be array.");
  if (!isPlainObject(workItemInput.metadata)) fail("workItemInput.metadata must be plain object.");
}

export function validateWorkCreationInputs({ workRuntime, workItemInput } = {}) {
  if (!workRuntime || typeof workRuntime !== "object") fail("workRuntime required object.");
  if (typeof workRuntime.applyEvent !== "function") fail("workRuntime.applyEvent must be function.");
  if (typeof workRuntime.getWorkItem !== "function") {
    // getWorkItem is used by the service to confirm creation.
    // It's not strictly required for correctness but required for deterministic validation here.
    fail("workRuntime.getWorkItem must be function.");
  }
  if (!workItemInput) fail("workItemInput required.");
  validateWorkItemInput(workItemInput);
  return { ok: true };
}

export function validateWorkItemCreatedEvent(event) {
  if (!event || typeof event !== "object") fail("event required object.");
  if (String(event.type) !== WORK_EVENT_TYPES.WORK_ITEM_CREATED) fail("event.type must be WORK_ITEM_CREATED.");
  if (!event.payload || !isPlainObject(event.payload)) fail("event.payload must be plain object.");
  if (!event.payload.workItem || typeof event.payload.workItem !== "object") fail("event.payload.workItem must be object.");
  return { ok: true };
}

