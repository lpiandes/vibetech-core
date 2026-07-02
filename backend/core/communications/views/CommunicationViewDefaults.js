export const VIEW_ID_COMMUNICATIONS = "vm_communications";

export const COMMUNICATION_VIEW_PRIORITIES = ["immediate", "soon", "later"];

export const ACTION_STYLE_BY_PRIORITY = {
  immediate: "danger",
  soon: "warning",
  later: "neutral",
};

export const ACTION_PRIORITIES_DEFAULT = {
  review_message: "immediate",
  send_message: "soon",
  retry_message: "immediate",
  archive_thread: "later",
  reply_to_message: "soon",
  view_related_work: "later",
  assign_owner: "immediate",
};

export const ACTION_TYPES = {
  review_message: "review_message",
  send_message: "send_message",
  retry_message: "retry_message",
  archive_thread: "archive_thread",
  reply_to_message: "reply_to_message",
  view_related_work: "view_related_work",
  assign_owner: "assign_owner",
};

export const QUEUE_DEFS = [
  { id: "q_drafts", name: "Drafts", type: "drafts", priority: "soon", status: "open" },
  { id: "q_queued", name: "Queued", type: "queued", priority: "soon", status: "open" },
  { id: "q_sent", name: "Sent", type: "sent", priority: "later", status: "open" },
  { id: "q_received", name: "Received", type: "received", priority: "soon", status: "open" },
  { id: "q_failed", name: "Failed", type: "failed", priority: "immediate", status: "open" },
  { id: "q_needs_attention", name: "Needs Attention", type: "needs_attention", priority: "immediate", status: "open" },
  { id: "q_archived", name: "Archived", type: "archived", priority: "later", status: "closed" },
];

// Attention thresholds are deterministic constants. Keep stable across industries.
export const QUEUED_WAIT_TOO_LONG_MS = 48 * 60 * 60 * 1000; // 48h
export const DRAFTS_OLDER_THAN_MS = 7 * 24 * 60 * 60 * 1000; // 7d

// Received messages requiring response:
export const RECEIVED_REQUIRES_RESPONSE_DIRECTION = "inbound";

export const ATTENTION_CATEGORIES = [
  "failed_messages",
  "queued_too_long",
  "drafts_old",
  "received_needs_response",
  "threads_failed_latest",
  "missing_recipients",
  "missing_sender",
];

