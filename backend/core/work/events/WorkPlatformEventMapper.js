import { PLATFORM_EVENT_AGGREGATE_TYPE, WORK_OS_PUBLISHER_ID } from "./WorkPlatformEventDefaults.js";

function fail(message) {
  throw new Error(`WorkPlatformEventMapper: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function deterministicEventId({ workItemId, createdAtISO }) {
  return `evt_work_created_${String(workItemId)}_${String(createdAtISO)}`;
}

function safeNullToStringOrNull(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

/**
 * Maps a WorkRuntime WORK_ITEM_CREATED event + resulting WorkItem into canonical WORK_CREATED PlatformEvent input.
 * Accepts either `workCreatedEvent` (best-effort from WorkRuntime event) or `createdWorkItem`.
 */
export function mapWorkItemCreatedToPlatformEventInput({
  workRuntime,
  workCreatedEvent,
  createdWorkItem,
  createdAtISO,
} = {}) {
  const ev = workCreatedEvent;
  const payload = ev?.payload ?? {};

  const workItem = createdWorkItem ?? payload?.workItem ?? null;
  if (!workItem && workRuntime && typeof workRuntime.getWorkItem === "function") {
    const workItemId = ev?.payload?.workItem?.id ?? createdWorkItem?.id ?? null;
    if (workItemId) {
      // @ts-ignore best-effort.
      const fetched = workRuntime.getWorkItem(String(workItemId));
      if (fetched) createdWorkItem = fetched;
    }
  }

  const item = createdWorkItem ?? workItem;
  if (!item) fail("created work item required.");

  const workItemId = requireString(String(item.id), "workItemId");
  const ts = createdAtISO ?? ev?.timestampISO ?? item.createdAt;
  const timestampISO = requireString(String(ts), "createdAtISO");

  const payloadMetadata = isPlainObject(item.metadata) ? item.metadata : {};

  const eventInput = {
    eventId: deterministicEventId({ workItemId, createdAtISO: timestampISO }),
    eventType: "WORK_CREATED",
    aggregateType: PLATFORM_EVENT_AGGREGATE_TYPE,
    aggregateId: String(workItemId),
    occurredAt: String(timestampISO),
    publisher: WORK_OS_PUBLISHER_ID, // publisher contract sets this, but included here for completeness.
    correlationId: String(ev?.id ?? `work_created_${workItemId}_${timestampISO}`),
    causationId: String(ev?.id ?? `work_created_${workItemId}_${timestampISO}`),
    payload: {
      workItemId: String(item.id),
      title: String(item.title),
      description: String(item.description),
      workType: String(item.workType),
      status: String(item.status),
      priority: String(item.priority),
      stageId: String(item.stageId),
      queueId: String(item.queueId),
      assignedTo: String(item.assignedTo),
      requestedBy: String(item.requestedBy),
      source: String(item.source),
      createdAt: String(item.createdAt ?? timestampISO),
      relatedObjects: Array.isArray(item.relatedObjects) ? item.relatedObjects : [],
      metadata: payloadMetadata,
    },
    metadata: {
      derivedFrom: { workItemId: String(item.id) },
    },
  };

  return eventInput;
}

