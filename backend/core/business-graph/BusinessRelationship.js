import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`BusinessRelationship: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return String(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireEntityRef(ref, name) {
  if (!isPlainObject(ref)) fail(`${name} must be a plain object.`);
  const entityType = requireString(ref.entityType, `${name}.entityType`);
  const entityId = requireString(ref.entityId, `${name}.entityId`);
  return deepFreeze({ entityType, entityId });
}

export function createBusinessRelationship({
  id,
  fromEntity,
  toEntity,
  relationshipType,
  status,
  effectiveFrom,
  effectiveTo = null,
  metadata = {},
  createdAt,
  updatedAt,
} = {}) {
  requireString(id, "id");
  requireString(relationshipType, "relationshipType");
  requireString(status, "status");

  const from = requireEntityRef(fromEntity, "fromEntity");
  const to = requireEntityRef(toEntity, "toEntity");

  requireString(effectiveFrom, "effectiveFrom");
  if (effectiveTo !== null && effectiveTo !== undefined) {
    if (typeof effectiveTo !== "string") fail("effectiveTo must be string or null.");
  }

  if (!isPlainObject(metadata)) fail("metadata must be plain object.");
  requireString(createdAt, "createdAt");
  requireString(updatedAt, "updatedAt");

  return deepFreeze({
    id: String(id),
    fromEntity: from,
    toEntity: to,
    relationshipType: String(relationshipType),
    status: String(status),
    effectiveFrom: String(effectiveFrom),
    effectiveTo: effectiveTo === undefined ? null : effectiveTo === null ? null : String(effectiveTo),
    metadata: deepFreeze(metadata),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  });
}
