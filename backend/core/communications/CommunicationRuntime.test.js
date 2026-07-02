import assert from "node:assert/strict";
import { test } from "node:test";

import { CommunicationRuntime } from "./CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "./CommunicationEventTypes.js";
import { buildCommunicationThreadForSeed, buildCommunicationMessageForSeed } from "./CommunicationBuilder.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:01:00.000Z";
const NOW2 = "2026-07-01T00:02:00.000Z";

function makeThread({ id = "ct_1", status = "draft", channel = "email" } = {}) {
  return buildCommunicationThreadForSeed({
    nowISO: NOW0,
    overrides: {
      id,
      subject: "Thread subject",
      channel,
      status,
      participants: [{ id: "p_sender", type: "human" }, { id: "p_recipient", type: "human" }],
      messageIds: [],
      relatedObjects: [],
      createdAt: NOW0,
      updatedAt: NOW0,
      metadata: {},
    },
  });
}

test("CommunicationRuntime: runtime creation is deeply frozen and metrics are zero", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  assert.ok(Object.isFrozen(rt._state));
  assert.equal(rt.getMetrics().totalThreads, 0);
  assert.equal(rt.getMetrics().totalMessages, 0);
  assert.equal(rt.getMetrics().draftMessages, 0);
  assert.equal(rt.getMetrics().queuedMessages, 0);
  assert.equal(rt.getMetrics().sentMessages, 0);
  assert.equal(rt.getMetrics().deliveredMessages, 0);
  assert.equal(rt.getMetrics().failedMessages, 0);
  assert.equal(rt.getMetrics().receivedMessages, 0);
});

test("Thread creation: COMMUNICATION_THREAD_CREATED adds a thread and updates metrics", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  rt.applyEvent({
    id: "evt_thread_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread: makeThread() },
  });

  const t = rt.getThread("ct_1");
  assert.ok(t);
  assert.equal(t.subject, "Thread subject");
  assert.equal(t.status, "draft");
  assert.ok(Object.isFrozen(t));

  assert.equal(rt.getMetrics().totalThreads, 1);
  assert.equal(rt.getMetrics().totalMessages, 0);
});

test("Message lifecycle: draft -> queued -> sent -> delivered; metrics and timestamps update deterministically", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  rt.applyEvent({
    id: "evt_thread_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread: makeThread() },
  });

  const message = buildCommunicationMessageForSeed({
    nowISO: NOW0,
    threadId: "ct_1",
    overrides: {
      id: "cm_1",
      direction: "outbound",
      channel: "email",
      status: "draft",
      subject: "Hello",
      body: "Body",
      sender: { id: "p_sender", type: "human" },
      recipients: [{ id: "p_recipient", type: "human" }],
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  const threadBefore = rt.getThread("ct_1");
  assert.equal(threadBefore.messageIds.length, 0);

  rt.applyEvent({
    id: "evt_msg_draft_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message },
  });

  const msgAfterDraft = rt.getMessage("cm_1");
  assert.equal(msgAfterDraft.status, "draft");
  assert.equal(rt.getMetrics().draftMessages, 1);
  assert.equal(rt.getMetrics().totalMessages, 1);

  // Immutability check: previously retrieved thread object isn't mutated.
  assert.ok(Object.isFrozen(threadBefore));
  assert.deepEqual(threadBefore.messageIds, []);

  rt.applyEvent({
    id: "evt_msg_queued_1",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
    source: "test",
    payload: { messageId: "cm_1" },
  });
  assert.equal(rt.getMessage("cm_1").status, "queued");
  assert.equal(rt.getMetrics().queuedMessages, 1);

  rt.applyEvent({
    id: "evt_msg_sent_1",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_SENT,
    source: "test",
    payload: { messageId: "cm_1" },
  });
  assert.equal(rt.getMessage("cm_1").status, "sent");
  assert.equal(rt.getMessage("cm_1").sentAt, NOW1);
  assert.equal(rt.getMetrics().sentMessages, 1);

  rt.applyEvent({
    id: "evt_msg_delivered_1",
    timestampISO: NOW2,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DELIVERED,
    source: "test",
    payload: { messageId: "cm_1" },
  });
  assert.equal(rt.getMessage("cm_1").status, "delivered");
  assert.equal(rt.getMessage("cm_1").deliveredAt, NOW2);
  assert.equal(rt.getMetrics().deliveredMessages, 1);
});

test("Message lifecycle: queued -> failed; received messages update status", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  rt.applyEvent({
    id: "evt_thread_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread: makeThread({ id: "ct_1" }) },
  });

  const failedMsg = buildCommunicationMessageForSeed({
    nowISO: NOW0,
    threadId: "ct_1",
    overrides: {
      id: "cm_failed",
      direction: "outbound",
      channel: "email",
      status: "draft",
      subject: "Will fail",
      body: "Body",
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  rt.applyEvent({
    id: "evt_msg_draft_failed",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message: failedMsg },
  });

  rt.applyEvent({
    id: "evt_msg_queued_failed",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
    source: "test",
    payload: { messageId: "cm_failed" },
  });
  assert.equal(rt.getMessage("cm_failed").status, "queued");

  rt.applyEvent({
    id: "evt_msg_failed",
    timestampISO: NOW2,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
    source: "test",
    payload: { messageId: "cm_failed" },
  });
  assert.equal(rt.getMessage("cm_failed").status, "failed");
  assert.equal(rt.getMessage("cm_failed").failedAt, NOW2);
  assert.equal(rt.getMetrics().failedMessages, 1);

  const receivedMsg = buildCommunicationMessageForSeed({
    nowISO: NOW0,
    threadId: "ct_1",
    overrides: {
      id: "cm_received",
      direction: "inbound",
      channel: "chat",
      status: "draft",
      subject: "Received",
      body: "Incoming",
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  rt.applyEvent({
    id: "evt_msg_draft_received",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message: receivedMsg },
  });

  rt.applyEvent({
    id: "evt_msg_received",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_RECEIVED,
    source: "test",
    payload: { messageId: "cm_received" },
  });
  assert.equal(rt.getMessage("cm_received").status, "received");
  assert.equal(rt.getMessage("cm_received").sentAt, NOW1);
  assert.equal(rt.getMetrics().receivedMessages, 1);
});

test("Thread archived: COMMUNICATION_THREAD_ARCHIVED sets thread status archived and updates updatedAt", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  rt.applyEvent({
    id: "evt_thread_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread: makeThread() },
  });

  rt.applyEvent({
    id: "evt_thread_archived_1",
    timestampISO: NOW2,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_ARCHIVED,
    source: "test",
    payload: { threadId: "ct_1" },
  });

  const t = rt.getThread("ct_1");
  assert.equal(t.status, "archived");
  assert.equal(t.updatedAt, NOW2);
});

test("Validation: unknown event type throws deterministically", () => {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });
  assert.throws(() => {
    rt.applyEvent({
      id: "evt_bad_1",
      timestampISO: NOW0,
      type: "BAD_EVENT",
      source: "test",
      payload: {},
    });
  });
});

