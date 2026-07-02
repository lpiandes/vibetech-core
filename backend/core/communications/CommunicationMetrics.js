import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { COMMUNICATION_STATUSES } from "./CommunicationStatus.js";

export function createCommunicationMetrics({
  totalThreads,
  totalMessages,
  draftMessages,
  queuedMessages,
  sentMessages,
  deliveredMessages,
  failedMessages,
  receivedMessages,
  metadata,
} = {}) {
  const m = {
    totalThreads: Number(totalThreads ?? 0),
    totalMessages: Number(totalMessages ?? 0),
    draftMessages: Number(draftMessages ?? 0),
    queuedMessages: Number(queuedMessages ?? 0),
    sentMessages: Number(sentMessages ?? 0),
    deliveredMessages: Number(deliveredMessages ?? 0),
    failedMessages: Number(failedMessages ?? 0),
    receivedMessages: Number(receivedMessages ?? 0),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  for (const key of [
    "totalThreads",
    "totalMessages",
    "draftMessages",
    "queuedMessages",
    "sentMessages",
    "deliveredMessages",
    "failedMessages",
    "receivedMessages",
  ]) {
    if (!Number.isFinite(m[key]) || m[key] < 0) {
      throw new Error(`CommunicationMetrics: ${key} must be non-negative number.`);
    }
  }

  // Sanity: no unused statuses enforcement (statuses include archived/received).
  if (!Array.isArray(COMMUNICATION_STATUSES)) {
    throw new Error("CommunicationMetrics: COMMUNICATION_STATUSES missing.");
  }

  return deepFreeze(m);
}

export function computeCommunicationMetrics({ threads, messages } = {}) {
  const t = Array.isArray(threads) ? threads : [];
  const msgs = Array.isArray(messages) ? messages : [];

  let draftMessages = 0;
  let queuedMessages = 0;
  let sentMessages = 0;
  let deliveredMessages = 0;
  let failedMessages = 0;
  let receivedMessages = 0;

  for (const msg of msgs) {
    const st = String(msg?.status ?? "");
    if (st === "draft") draftMessages += 1;
    else if (st === "queued") queuedMessages += 1;
    else if (st === "sent") sentMessages += 1;
    else if (st === "delivered") deliveredMessages += 1;
    else if (st === "failed") failedMessages += 1;
    else if (st === "received") receivedMessages += 1;
  }

  return createCommunicationMetrics({
    totalThreads: t.length,
    totalMessages: msgs.length,
    draftMessages,
    queuedMessages,
    sentMessages,
    deliveredMessages: deliveredMessages,
    failedMessages,
    receivedMessages,
    metadata: deepFreeze({ derivedFrom: { compute: true } }),
  });
}

