import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`EngagementTimelineItem: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createEngagementTimelineItem({
  id,
  type,
  category,
  occurredAt,
  title,
  description,
  status,
  actor,
  relatedObjects,
  sourceReference,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!type || typeof type !== "string") fail("type required.");
  if (!category || typeof category !== "string") fail("category required.");
  if (!occurredAt || typeof occurredAt !== "string") fail("occurredAt required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!description || typeof description !== "string") fail("description required.");
  if (!sourceReference || !isPlainObject(sourceReference)) fail("sourceReference required.");

  return deepFreeze({
    id: String(id),
    type: String(type),
    category: String(category),
    occurredAt: String(occurredAt),
    title: String(title),
    description: String(description),
    status: status === undefined || status === null ? null : String(status),
    actor: actor === undefined || actor === null ? null : String(actor),
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    sourceReference: deepFreeze(sourceReference),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  });
}
