import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createCommunicationParticipant } from "./CommunicationParticipant.js";
import { COMMUNICATION_STATUSES } from "./CommunicationStatus.js";
import { COMMUNICATION_DIRECTIONS } from "./CommunicationDirection.js";
import { COMMUNICATION_CHANNELS } from "./CommunicationChannel.js";

function fail(message) {
  throw new Error(`CommunicationMessage: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createCommunicationMessage({
  id,
  threadId,
  direction,
  channel,
  status,
  sender,
  recipients,
  subject,
  body,
  createdAt,
  sentAt,
  deliveredAt,
  failedAt,
  relatedObjects,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required string.");
  if (!threadId || typeof threadId !== "string") fail("threadId required string.");
  if (!direction || typeof direction !== "string") fail("direction required string.");
  if (!channel || typeof channel !== "string") fail("channel required string.");
  if (!status || typeof status !== "string") fail("status required string.");

  const dir = String(direction);
  if (!COMMUNICATION_DIRECTIONS.includes(dir)) fail(`invalid direction: ${dir}`);

  const ch = String(channel);
  if (!COMMUNICATION_CHANNELS.includes(ch)) fail(`invalid channel: ${ch}`);

  const st = String(status);
  if (!COMMUNICATION_STATUSES.includes(st)) fail(`invalid status: ${st}`);

  const safeCreatedAt = createdAt ? String(createdAt) : null;
  if (!safeCreatedAt) fail("createdAt required.");

  const safeSentAt = sentAt === undefined ? null : sentAt === null ? null : String(sentAt);
  const safeDeliveredAt = deliveredAt === undefined ? null : deliveredAt === null ? null : String(deliveredAt);
  const safeFailedAt = failedAt === undefined ? null : failedAt === null ? null : String(failedAt);

  const safeSender = isPlainObject(sender) ? createCommunicationParticipant({ id: sender.id ?? sender.participantId, type: sender.type ?? sender.participantType, metadata: sender.metadata ?? {} }) : createCommunicationParticipant({ id: "unknown_sender", type: "unknown" });

  const safeRecipients = Array.isArray(recipients) ? recipients : [];
  const recipientParticipants = safeRecipients.map((r) =>
    createCommunicationParticipant({
      id: r?.id ?? r?.participantId ?? "",
      type: r?.type ?? r?.participantType ?? "unknown",
      metadata: r?.metadata ?? {},
    }),
  );

  const msg = {
    id: String(id),
    threadId: String(threadId),
    direction: dir,
    channel: ch,
    status: st,
    sender: safeSender,
    recipients: deepFreeze(recipientParticipants),
    subject: String(subject ?? ""),
    body: String(body ?? ""),
    createdAt: safeCreatedAt,
    sentAt: safeSentAt,
    deliveredAt: safeDeliveredAt,
    failedAt: safeFailedAt,
    relatedObjects: deepFreeze(Array.isArray(relatedObjects) ? relatedObjects : []),
    metadata: metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(msg);
}

