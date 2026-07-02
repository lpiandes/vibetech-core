import { mapWorkItemCreatedToPlatformEventInput } from "./WorkPlatformEventMapper.js";

function fail(message) {
  throw new Error(`WorkPlatformEventValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateWorkCreatedPlatformEventInput(input) {
  if (!input || typeof input !== "object") fail("input required.");
  if (String(input.eventType) !== "WORK_CREATED") return { ok: false, skipped: true };

  if (!isPlainObject(input.payload)) fail("payload must be plain object.");
  const p = input.payload;
  for (const k of [
    "workItemId",
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
    "relatedObjects",
    "metadata",
  ]) {
    if (!(k in p)) fail(`payload missing ${k}`);
  }

  if (!Array.isArray(p.relatedObjects)) fail("payload.relatedObjects must be array.");
  if (!isPlainObject(p.metadata)) fail("payload.metadata must be plain object.");

  return { ok: true, skipped: false, errors: [] };
}

export function validateWorkItemCreatedToPlatformEventInput({ workRuntime, workCreatedEvent, createdWorkItem, createdAtISO } = {}) {
  const input = mapWorkItemCreatedToPlatformEventInput({ workRuntime, workCreatedEvent, createdWorkItem, createdAtISO });
  validateWorkCreatedPlatformEventInput(input);
  return { ok: true };
}

