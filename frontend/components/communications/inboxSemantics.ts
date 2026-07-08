import type { StatusBadgeTone } from "@/components/product/StatusBadge";

export type InboxFilter = "all" | "needs_reply" | "waiting";

export type InboxThread = {
  id?: string;
  subject?: string;
  channel?: string;
  status?: string;
  latestMessageAt?: string | null;
  attentionRequired?: boolean;
  participants?: Array<{ id?: string; type?: string; name?: string | null }>;
  relatedObjects?: Array<{ entityType?: string; entityId?: string } | string>;
};

export type InboxMessage = {
  id?: string;
  threadId?: string;
  direction?: string;
  status?: string;
  bodyPreview?: string;
  subject?: string;
  createdAt?: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  sender?: { id?: string; type?: string; name?: string | null };
  recipients?: Array<{ id?: string; type?: string; name?: string | null }>;
};

export type InboxAttentionItem = {
  category?: string;
  metadata?: { threadId?: string; messageId?: string };
};

export type InboxMetrics = {
  totalThreads?: number;
  queuedMessages?: number;
  sentMessages?: number;
  deliveredMessages?: number;
};

export type DeliveryPresentation = {
  label: string;
  tone: StatusBadgeTone;
};

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeStatus(status: unknown) {
  return String(status ?? "").toLowerCase();
}

function isInternalParticipant(participant: { type?: string } | null | undefined) {
  const type = normalizeStatus(participant?.type);
  return type === "human" || type === "digital_employee" || type === "automation";
}

function emailFromIdentifier(value: unknown) {
  const id = String(value ?? "");
  return id.includes("@") ? id : null;
}

export function getThreadMessages(threadId: string, messages: unknown) {
  const tid = String(threadId);
  return safeArray<InboxMessage>(messages).filter((message) => String(message.threadId) === tid);
}

export function getOutboundMessage(thread: InboxThread, messages: unknown) {
  const threadMessages = getThreadMessages(String(thread.id), messages);
  return (
    threadMessages.find((message) => normalizeStatus(message.direction) === "outbound") ??
    threadMessages[threadMessages.length - 1] ??
    null
  );
}

/** Preserve delivery semantics — queued is never labeled sent. */
export function deliveryStatusPresentation(status: unknown): DeliveryPresentation {
  const normalized = normalizeStatus(status);
  if (normalized === "sent" || normalized === "delivered") return { label: "Sent", tone: "success" };
  if (normalized === "queued") return { label: "Queued", tone: "info" };
  if (normalized === "failed" || normalized === "blocked") return { label: "Failed", tone: "warning" };
  if (normalized === "draft") return { label: "Draft", tone: "neutral" };
  if (normalized === "received") return { label: "Received", tone: "info" };
  return { label: status ? String(status) : "Recorded", tone: "neutral" };
}

export function deliveryStatusForThread(thread: InboxThread, messages: unknown): DeliveryPresentation {
  const outbound = getOutboundMessage(thread, messages);
  return deliveryStatusPresentation(outbound?.status ?? thread.status);
}

export function threadAttentionItems(threadId: string, attentionItems: unknown) {
  const tid = String(threadId);
  return safeArray<InboxAttentionItem>(attentionItems).filter(
    (item) => String(item?.metadata?.threadId ?? "") === tid,
  );
}

export function threadNeedsReply(thread: InboxThread, messages: unknown, attentionItems: unknown) {
  const tid = String(thread.id ?? "");
  const categories = threadAttentionItems(tid, attentionItems).map((item) => String(item.category ?? ""));

  if (categories.includes("received_needs_response")) return true;

  return getThreadMessages(tid, messages).some(
    (message) =>
      normalizeStatus(message.status) === "received" &&
      normalizeStatus(message.direction) === "inbound",
  );
}

export function threadWaiting(thread: InboxThread, messages: unknown, attentionItems: unknown) {
  const tid = String(thread.id ?? "");
  const categories = threadAttentionItems(tid, attentionItems).map((item) => String(item.category ?? ""));

  if (categories.includes("queued_too_long")) return true;

  return getThreadMessages(tid, messages).some((message) => normalizeStatus(message.status) === "queued");
}

export function extractThreadContact(thread: InboxThread, messages: unknown) {
  const threadMessages = getThreadMessages(String(thread.id), messages);

  for (const participant of safeArray<{ id?: string; type?: string; name?: string | null }>(thread.participants)) {
    if (!isInternalParticipant(participant)) {
      const name = participant?.name ? String(participant.name) : null;
      const email = emailFromIdentifier(participant?.id) ?? emailFromIdentifier(participant?.name);
      if (name || email) return { name, email };
    }
  }

  for (const message of threadMessages) {
    for (const recipient of safeArray<{ id?: string; type?: string; name?: string | null }>(message.recipients)) {
      if (!isInternalParticipant(recipient)) {
        const name = recipient?.name ? String(recipient.name) : null;
        const email = emailFromIdentifier(recipient?.id) ?? emailFromIdentifier(recipient?.name);
        if (name || email) return { name, email };
      }
    }

    if (!isInternalParticipant(message.sender)) {
      const name = message.sender?.name ? String(message.sender.name) : null;
      const email = emailFromIdentifier(message.sender?.id) ?? emailFromIdentifier(message.sender?.name);
      if (name || email) return { name, email };
    }
  }

  return { name: null, email: null };
}

export function threadPreview(thread: InboxThread, messages: unknown) {
  const threadMessages = getThreadMessages(String(thread.id), messages);
  const latest = threadMessages[threadMessages.length - 1];
  const preview = String(latest?.bodyPreview ?? "").trim();
  return preview || null;
}

export function sortThreadsByLatestActivity(threads: unknown) {
  return safeArray<InboxThread>(threads)
    .slice()
    .sort((a, b) => String(b.latestMessageAt ?? "").localeCompare(String(a.latestMessageAt ?? "")));
}

export function filterThreads(
  threads: unknown,
  filter: InboxFilter,
  messages: unknown,
  attentionItems: unknown,
) {
  const sorted = sortThreadsByLatestActivity(threads);

  if (filter === "needs_reply") {
    return sorted.filter((thread) => threadNeedsReply(thread, messages, attentionItems));
  }

  if (filter === "waiting") {
    return sorted.filter((thread) => threadWaiting(thread, messages, attentionItems));
  }

  return sorted;
}

export function deriveInboxCounts(
  threads: unknown,
  messages: unknown,
  attentionItems: unknown,
  metrics: InboxMetrics = {},
) {
  const allThreads = safeArray<InboxThread>(threads);
  const needsReply = allThreads.filter((thread) => threadNeedsReply(thread, messages, attentionItems)).length;
  const waiting = allThreads.filter((thread) => threadWaiting(thread, messages, attentionItems)).length;
  const queuedMessages = Number(metrics.queuedMessages ?? 0);
  const sentMessages = Number(metrics.sentMessages ?? 0) + Number(metrics.deliveredMessages ?? 0);

  const deliveryMetric =
    queuedMessages > 0
      ? { id: "queued", label: "Queued", value: queuedMessages }
      : { id: "sent", label: "Sent", value: sentMessages };

  return {
    conversations: Number(metrics.totalThreads ?? allThreads.length),
    needsReply,
    waiting,
    deliveryMetric,
    filters: {
      all: allThreads.length,
      needs_reply: needsReply,
      waiting,
    },
  };
}

export function formatInboxTimestamp(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
