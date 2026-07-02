import { COMMUNICATION_STATUSES } from "./CommunicationStatus.js";

function fail(message) {
  throw new Error(`CommunicationRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function uniqueIds(items, label) {
  const seen = new Set();
  for (const x of items) {
    const id = String(x?.id ?? "");
    if (!id) fail(`${label} missing id`);
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateCommunicationRuntime(runtime) {
  const state = runtime?._state ?? runtime;
  if (!state || typeof state !== "object") fail("runtime state required.");
  if (!Object.isFrozen(state)) fail("communication runtime state must be frozen.");

  const { threads, messages, metrics } = state;
  if (!Array.isArray(threads)) fail("threads must be array.");
  if (!Array.isArray(messages)) fail("messages must be array.");

  uniqueIds(threads, "thread");
  uniqueIds(messages, "message");

  const threadIds = new Set(threads.map((t) => String(t.id)));

  // Validate threads.
  for (const t of threads) {
    const st = String(t?.status ?? "");
    if (!COMMUNICATION_STATUSES.includes(st)) fail(`invalid thread status: ${st}`);
    if (!t?.id || typeof t.id !== "string") fail("thread.id required string");
    if (!Array.isArray(t.participants)) fail("thread.participants must be array");
    if (!Array.isArray(t.messageIds)) fail("thread.messageIds must be array");
    if (!Array.isArray(t.relatedObjects)) fail("thread.relatedObjects must be array");
    if (!t.subject || typeof t.subject !== "string") fail("thread.subject required string");
    if (!t.channel || typeof t.channel !== "string") fail("thread.channel required string");
    if (!t.createdAt || typeof t.createdAt !== "string") fail("thread.createdAt required string");
    if (!t.updatedAt || typeof t.updatedAt !== "string") fail("thread.updatedAt required string");
  }

  // Validate messages refer to existing threads.
  for (const m of messages) {
    if (!m?.threadId || typeof m.threadId !== "string") fail("message.threadId required string");
    if (!threadIds.has(String(m.threadId))) fail(`message.threadId missing thread: ${String(m.threadId)}`);
    const st = String(m?.status ?? "");
    if (!COMMUNICATION_STATUSES.includes(st)) fail(`invalid message status: ${st}`);
    if (!m?.id || typeof m.id !== "string") fail("message.id required string");
    if (!m?.direction || typeof m.direction !== "string") fail("message.direction required string");
    if (!m?.channel || typeof m.channel !== "string") fail("message.channel required string");
    if (!m?.sender || typeof m.sender !== "object") fail("message.sender required object");
    if (!Array.isArray(m.recipients)) fail("message.recipients must be array");
    if (!m.createdAt || typeof m.createdAt !== "string") fail("message.createdAt required string");
  }

  // Validate thread.messageIds are consistent with messages best-effort.
  const messageIds = new Set(messages.map((m) => String(m.id)));
  for (const t of threads) {
    const ids = Array.isArray(t.messageIds) ? t.messageIds : [];
    for (const id of ids) {
      if (!messageIds.has(String(id))) fail(`thread ${String(t.id)} references missing messageId ${String(id)}`);
    }
  }

  // Metrics sanity must match.
  if (!metrics || typeof metrics !== "object") fail("metrics required.");
  for (const k of [
    "totalThreads",
    "totalMessages",
    "draftMessages",
    "queuedMessages",
    "sentMessages",
    "deliveredMessages",
    "failedMessages",
    "receivedMessages",
  ]) {
    if (typeof metrics[k] !== "number" || !Number.isFinite(metrics[k])) fail(`metrics.${k} must be finite number`);
  }

  const computed = {
    totalThreads: threads.length,
    totalMessages: messages.length,
    draftMessages: messages.filter((m) => String(m.status) === "draft").length,
    queuedMessages: messages.filter((m) => String(m.status) === "queued").length,
    sentMessages: messages.filter((m) => String(m.status) === "sent").length,
    deliveredMessages: messages.filter((m) => String(m.status) === "delivered").length,
    failedMessages: messages.filter((m) => String(m.status) === "failed").length,
    receivedMessages: messages.filter((m) => String(m.status) === "received").length,
  };

  for (const k of Object.keys(computed)) {
    if (metrics[k] !== computed[k]) fail(`metrics.${k} mismatch: expected ${computed[k]} got ${metrics[k]}`);
  }

  // Ensure deep immutability for nested.
  if (!Object.isFrozen(state.metrics)) fail("metrics object must be frozen");
  if (threads.length && !Object.isFrozen(threads[0])) fail("threads elements must be frozen");
  if (messages.length && !Object.isFrozen(messages[0])) fail("messages elements must be frozen");

  // Prevent accidental runtime mutation patterns.
  return { ok: true };
}

