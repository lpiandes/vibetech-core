import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`Interaction: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return String(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createInteraction({
  id,
  interactionType,
  direction,
  channel,
  occurredAt,
  startedAt = null,
  endedAt = null,
  participants = [],
  relatedObjects = [],
  ownerId = null,
  status = "active",
  summary = "",
  notes = [],
  outcome = null,
  nextStep = null,
  followUpAt = null,
  source = null,
  externalReference = null,
  metadata = {},
  createdAt,
  updatedAt,
} = {}) {
  requireString(id, "id");
  requireString(interactionType, "interactionType");
  requireString(direction, "direction");
  requireString(channel, "channel");
  requireString(occurredAt, "occurredAt");
  requireString(createdAt, "createdAt");
  requireString(updatedAt, "updatedAt");

  if (!Array.isArray(participants)) fail("participants must be array.");
  if (!Array.isArray(relatedObjects)) fail("relatedObjects must be array.");
  if (!Array.isArray(notes)) fail("notes must be array.");
  if (!isPlainObject(metadata)) fail("metadata must be plain object.");

  const safeStartedAt = startedAt === undefined ? null : startedAt === null ? null : String(startedAt);
  const safeEndedAt = endedAt === undefined ? null : endedAt === null ? null : String(endedAt);
  const safeOwnerId = ownerId === undefined ? null : ownerId === null ? null : String(ownerId);
  const safeOutcome = outcome === undefined ? null : outcome;
  const safeNextStep = nextStep === undefined ? null : nextStep;
  const safeFollowUpAt = followUpAt === undefined ? null : followUpAt === null ? null : String(followUpAt);
  const safeSource = source === undefined ? null : source === null ? null : String(source);
  const safeExternalReference = externalReference === undefined ? null : externalReference === null ? null : String(externalReference);

  return deepFreeze({
    id: String(id),
    interactionType: String(interactionType),
    direction: String(direction),
    channel: String(channel),
    occurredAt: String(occurredAt),
    startedAt: safeStartedAt,
    endedAt: safeEndedAt,
    participants: deepFreeze(participants),
    relatedObjects: deepFreeze(relatedObjects),
    ownerId: safeOwnerId,
    status: String(status),
    summary: String(summary ?? ""),
    notes: deepFreeze(notes),
    outcome: safeOutcome,
    nextStep: safeNextStep,
    followUpAt: safeFollowUpAt,
    source: safeSource,
    externalReference: safeExternalReference,
    metadata: deepFreeze(metadata),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  });
}
