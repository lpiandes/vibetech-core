import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`InteractionNote: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return String(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createInteractionNote({
  id,
  interactionId,
  authorId,
  timestampISO,
  text,
  relatedObjects = [],
  metadata = {},
} = {}) {
  requireString(id, "id");
  requireString(interactionId, "interactionId");
  requireString(authorId, "authorId");
  requireString(timestampISO, "timestampISO");
  requireString(text, "text");

  const ro = Array.isArray(relatedObjects) ? relatedObjects : [];
  if (!isPlainObject(metadata)) fail("metadata must be plain object.");

  return deepFreeze({
    id: String(id),
    interactionId: String(interactionId),
    authorId: String(authorId),
    timestampISO: String(timestampISO),
    text: String(text), // Preserve original human-entered text exactly.
    relatedObjects: deepFreeze(ro),
    metadata: deepFreeze(metadata),
  });
}
