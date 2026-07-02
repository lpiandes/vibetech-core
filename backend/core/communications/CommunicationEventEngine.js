import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  COMMUNICATION_EVENT_TYPES,
  SUPPORTED_COMMUNICATION_EVENT_TYPES,
} from "./CommunicationEventTypes.js";

import { createCommunicationThread } from "./CommunicationThread.js";
import { createCommunicationMessage } from "./CommunicationMessage.js";

import { computeCommunicationMetrics } from "./CommunicationMetrics.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`CommunicationEventEngine: expected ${name} to be a string.`);
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findById(items, id) {
  const sid = String(id);
  return items.find((x) => String(x?.id) === sid) ?? null;
}

function upsertThreadMessageId({ thread, messageId }) {
  const ids = Array.isArray(thread?.messageIds) ? thread.messageIds.map(String) : [];
  if (!ids.includes(String(messageId))) ids.push(String(messageId));
  return ids;
}

export class CommunicationEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("CommunicationEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("CommunicationEventEngine: event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");

    if (!isPlainObject(event.payload)) throw new Error("CommunicationEventEngine: event.payload must be a plain object.");
    if (!SUPPORTED_COMMUNICATION_EVENT_TYPES.includes(event.type)) {
      throw new Error(`CommunicationEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;
    let threads = safeClone(prev.threads);
    let messages = safeClone(prev.messages);
    const payload = event.payload;

    switch (event.type) {
      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED: {
        const { thread } = payload;
        if (!isPlainObject(thread)) throw new Error("THREAD_CREATED: thread payload required.");
        const created = createCommunicationThread(thread);
        if (threads.some((t) => String(t.id) === created.id)) throw new Error("THREAD_CREATED: thread already exists.");
        threads.push(created);
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED: {
        const { message } = payload;
        if (!isPlainObject(message)) throw new Error("MESSAGE_DRAFTED: message payload required.");
        const created = createCommunicationMessage({
          ...message,
          status: "draft",
        });

        if (messages.some((m) => String(m.id) === created.id)) throw new Error("MESSAGE_DRAFTED: message already exists.");

        const thread = findById(threads, created.threadId);
        if (!thread) throw new Error("MESSAGE_DRAFTED: thread does not exist.");

        // Ensure thread has this message id.
        const nextThread = createCommunicationThread({
          ...thread,
          messageIds: upsertThreadMessageId({ thread, messageId: created.id }),
          updatedAt: event.timestampISO,
          status: thread.status,
        });

        const tIdx = threads.findIndex((t) => String(t.id) === String(thread.id));
        threads[tIdx] = nextThread;

        messages.push(created);
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED: {
        const { messageId } = payload;
        requireString(messageId, "payload.messageId");

        const msg = findById(messages, messageId);
        if (!msg) throw new Error("MESSAGE_QUEUED: message does not exist.");

        const updated = createCommunicationMessage({
          ...msg,
          status: "queued",
          sentAt: msg.sentAt ?? null,
          deliveredAt: msg.deliveredAt ?? null,
          failedAt: msg.failedAt ?? null,
        });
        messages = messages.map((m) => (String(m.id) === String(messageId) ? updated : m));
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_SENT: {
        const { messageId } = payload;
        requireString(messageId, "payload.messageId");

        const msg = findById(messages, messageId);
        if (!msg) throw new Error("MESSAGE_SENT: message does not exist.");

        const sentAt = String(event.timestampISO);
        const updated = createCommunicationMessage({
          ...msg,
          status: "sent",
          sentAt,
          deliveredAt: msg.deliveredAt ?? null,
          failedAt: msg.failedAt ?? null,
        });
        messages = messages.map((m) => (String(m.id) === String(messageId) ? updated : m));
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DELIVERED: {
        const { messageId } = payload;
        requireString(messageId, "payload.messageId");

        const msg = findById(messages, messageId);
        if (!msg) throw new Error("MESSAGE_DELIVERED: message does not exist.");

        const deliveredAt = String(event.timestampISO);
        const updated = createCommunicationMessage({
          ...msg,
          status: "delivered",
          deliveredAt,
          sentAt: msg.sentAt ?? deliveredAt,
          failedAt: null,
        });
        messages = messages.map((m) => (String(m.id) === String(messageId) ? updated : m));
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED: {
        const { messageId } = payload;
        requireString(messageId, "payload.messageId");

        const msg = findById(messages, messageId);
        if (!msg) throw new Error("MESSAGE_FAILED: message does not exist.");

        const failedAt = String(event.timestampISO);
        const updated = createCommunicationMessage({
          ...msg,
          status: "failed",
          failedAt,
        });
        messages = messages.map((m) => (String(m.id) === String(messageId) ? updated : m));
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_RECEIVED: {
        const { messageId } = payload;
        requireString(messageId, "payload.messageId");

        const msg = findById(messages, messageId);
        if (!msg) throw new Error("MESSAGE_RECEIVED: message does not exist.");

        // For the model: we store received time in `sentAt` for deterministic minimal contract.
        const sentAt = String(event.timestampISO);
        const updated = createCommunicationMessage({
          ...msg,
          status: "received",
          sentAt,
        });
        messages = messages.map((m) => (String(m.id) === String(messageId) ? updated : m));
        break;
      }

      case COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_ARCHIVED: {
        const { threadId } = payload;
        requireString(threadId, "payload.threadId");

        const thread = findById(threads, threadId);
        if (!thread) throw new Error("THREAD_ARCHIVED: thread does not exist.");

        const updatedThread = createCommunicationThread({
          ...thread,
          status: "archived",
          updatedAt: String(event.timestampISO),
        });
        threads = threads.map((t) => (String(t.id) === String(threadId) ? updatedThread : t));
        break;
      }

      default:
        throw new Error(`CommunicationEventEngine: unhandled event type: ${event.type}`);
    }

    const nextMetrics = computeCommunicationMetrics({ threads, messages });
    const nextState = deepFreeze({
      threads: deepFreeze(threads),
      messages: deepFreeze(messages),
      metrics: nextMetrics,
    });

    this.runtime._state = nextState;
    return this.runtime._state;
  }
}

