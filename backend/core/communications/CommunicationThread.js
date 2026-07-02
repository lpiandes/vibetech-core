import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createCommunicationParticipant } from "./CommunicationParticipant.js";
import { COMMUNICATION_STATUSES } from "./CommunicationStatus.js";

function fail(message) {
  throw new Error(`CommunicationThread: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createCommunicationThread({
  id,
  subject,
  channel,
  status,
  participants,
  messageIds,
  relatedObjects,
  createdAt,
  updatedAt,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!subject || typeof subject !== "string") fail("subject required.");
  if (!channel || typeof channel !== "string") fail("channel required.");
  if (!status || typeof status !== "string") fail("status required.");
  if (!Array.isArray(participants)) fail("participants must be array.");
  if (!Array.isArray(messageIds)) fail("messageIds must be array.");
  if (!Array.isArray(relatedObjects)) fail("relatedObjects must be array.");
  if (!createdAt || typeof createdAt !== "string") fail("createdAt required.");
  if (!updatedAt || typeof updatedAt !== "string") fail("updatedAt required.");

  const st = String(status);
  if (!COMMUNICATION_STATUSES.includes(st)) fail(`invalid status: ${st}`);

  const threadParticipants = participants.map((p) =>
    createCommunicationParticipant({
      id: p?.id ?? p?.participantId ?? "",
      type: p?.type ?? p?.participantType ?? "unknown",
      metadata: p?.metadata ?? {},
    }),
  );

  const thread = {
    id: String(id),
    subject: String(subject),
    channel: String(channel),
    status: st,
    participants: deepFreeze(threadParticipants),
    messageIds: deepFreeze(messageIds.map(String)),
    relatedObjects: deepFreeze(relatedObjects ?? []),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(thread);
}

