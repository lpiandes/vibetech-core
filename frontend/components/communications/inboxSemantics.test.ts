import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deliveryStatusPresentation,
  deriveInboxCounts,
  filterThreads,
  sortThreadsByLatestActivity,
  threadNeedsReply,
  threadWaiting,
} from "./inboxSemantics.ts";

const attentionItems = [
  {
    category: "received_needs_response",
    metadata: { threadId: "ct_needs_reply" },
  },
  {
    category: "queued_too_long",
    metadata: { threadId: "ct_waiting" },
  },
];

const threads = [
  {
    id: "ct_all",
    subject: "General thread",
    latestMessageAt: "2026-07-03T00:00:00.000Z",
    status: "open",
  },
  {
    id: "ct_needs_reply",
    subject: "Needs response",
    latestMessageAt: "2026-07-02T00:00:00.000Z",
    status: "open",
    attentionRequired: true,
  },
  {
    id: "ct_waiting",
    subject: "Queued follow-up",
    latestMessageAt: "2026-07-01T00:00:00.000Z",
    status: "open",
    attentionRequired: true,
  },
];

const messages = [
  {
    id: "cm_queued",
    threadId: "ct_waiting",
    direction: "outbound",
    status: "queued",
    bodyPreview: "Thanks for reaching out.",
  },
  {
    id: "cm_received",
    threadId: "ct_needs_reply",
    direction: "inbound",
    status: "received",
    bodyPreview: "Can you send pricing?",
  },
  {
    id: "cm_sent",
    threadId: "ct_all",
    direction: "outbound",
    status: "sent",
    bodyPreview: "Sent update.",
  },
];

test("delivery status labels preserve queued vs sent semantics", () => {
  assert.deepEqual(deliveryStatusPresentation("queued"), { label: "Queued", tone: "info" });
  assert.deepEqual(deliveryStatusPresentation("sent"), { label: "Sent", tone: "success" });
  assert.deepEqual(deliveryStatusPresentation("delivered"), { label: "Sent", tone: "success" });
});

test("inbox metrics align with visible thread semantics", () => {
  const counts = deriveInboxCounts(threads, messages, attentionItems, {
    totalThreads: 3,
    queuedMessages: 1,
    sentMessages: 1,
    deliveredMessages: 0,
  });

  assert.equal(counts.conversations, 3);
  assert.equal(counts.needsReply, 1);
  assert.equal(counts.waiting, 1);
  assert.equal(counts.filters.all, 3);
  assert.equal(counts.deliveryMetric.label, "Queued");
  assert.equal(counts.deliveryMetric.value, 1);
});

test("filters return expected rows and waiting detection uses queued status", () => {
  assert.equal(threadNeedsReply(threads[1], messages, attentionItems), true);
  assert.equal(threadWaiting(threads[2], messages, attentionItems), true);
  assert.equal(filterThreads(threads, "needs_reply", messages, attentionItems).length, 1);
  assert.equal(filterThreads(threads, "waiting", messages, attentionItems).length, 1);
  assert.equal(filterThreads(threads, "all", messages, attentionItems).length, 3);
});

test("threads sort by latest activity descending", () => {
  const sorted = sortThreadsByLatestActivity(threads);
  assert.deepEqual(
    sorted.map((thread) => thread.id),
    ["ct_all", "ct_needs_reply", "ct_waiting"],
  );
});

test("delivery metric falls back to sent when no queued messages exist", () => {
  const counts = deriveInboxCounts(threads, messages, attentionItems, {
    totalThreads: 3,
    queuedMessages: 0,
    sentMessages: 2,
    deliveredMessages: 1,
  });

  assert.equal(counts.deliveryMetric.label, "Sent");
  assert.equal(counts.deliveryMetric.value, 3);
});
