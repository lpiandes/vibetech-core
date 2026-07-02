import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";

import { WORK_CREATION_EVENT_SOURCE } from "./WorkCreationDefaults.js";

function fail(message) {
  throw new Error(`WorkCreationMapper: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

export function mapWorkItemInputToWorkItemCreatedEvent({
  workItemInput,
  workEventId,
  timestampISO,
} = {}) {
  if (!workItemInput || typeof workItemInput !== "object") fail("workItemInput required.");
  requireString(workEventId, "workEventId");
  const ts = String(timestampISO ?? workItemInput?.createdAt);
  requireString(ts, "timestampISO");

  // WorkEventEngine expects { workItem } payload for WORK_ITEM_CREATED.
  return {
    id: workEventId,
    timestampISO: ts,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: WORK_CREATION_EVENT_SOURCE,
    payload: { workItem: workItemInput },
  };
}

export function deterministicWorkEventId({ workItemId, requestConvertedEventId } = {}) {
  return `evt_work_item_created_${String(requestConvertedEventId ?? "req")}_${String(workItemId)}`;
}

