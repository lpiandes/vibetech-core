import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createCommunicationMetrics, computeCommunicationMetrics } from "./CommunicationMetrics.js";
import { createCommunicationThread } from "./CommunicationThread.js";
import { createCommunicationMessage } from "./CommunicationMessage.js";

const NOW_ISO_DEFAULT = "2026-07-01T00:00:00.000Z";

export function buildDefaultCommunicationSeed() {
  const metrics = computeCommunicationMetrics({ threads: [], messages: [] });
  return deepFreeze({
    threads: deepFreeze([]),
    messages: deepFreeze([]),
    metrics,
  });
}

export function buildCommunicationThreadForSeed({
  nowISO = NOW_ISO_DEFAULT,
  overrides = {},
} = {}) {
  const thread = createCommunicationThread({
    id: overrides.id ?? "ct_1",
    subject: overrides.subject ?? "Deterministic thread subject",
    channel: overrides.channel ?? "internal",
    status: overrides.status ?? "draft",
    participants: overrides.participants ?? [],
    messageIds: overrides.messageIds ?? [],
    relatedObjects: overrides.relatedObjects ?? [],
    createdAt: overrides.createdAt ?? nowISO,
    updatedAt: overrides.updatedAt ?? nowISO,
    metadata: overrides.metadata ?? {},
  });
  return thread;
}

export function buildCommunicationMessageForSeed({
  nowISO = NOW_ISO_DEFAULT,
  overrides = {},
  threadId = "ct_1",
} = {}) {
  const msg = createCommunicationMessage({
    id: overrides.id ?? "cm_1",
    threadId: overrides.threadId ?? threadId,
    direction: overrides.direction ?? "outbound",
    channel: overrides.channel ?? "internal",
    status: overrides.status ?? "draft",
    sender: overrides.sender ?? { id: "p_sender", type: "human" },
    recipients: overrides.recipients ?? [{ id: "p_recipient", type: "human" }],
    subject: overrides.subject ?? "Deterministic message subject",
    body: overrides.body ?? "Deterministic message body",
    createdAt: overrides.createdAt ?? nowISO,
    sentAt: overrides.sentAt ?? null,
    deliveredAt: overrides.deliveredAt ?? null,
    failedAt: overrides.failedAt ?? null,
    relatedObjects: overrides.relatedObjects ?? [],
    metadata: overrides.metadata ?? {},
  });
  return msg;
}

