import assert from "node:assert/strict";
import { test } from "node:test";

import { CommunicationRuntime } from "../CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "../CommunicationEventTypes.js";
import { buildCommunicationThreadForSeed, buildCommunicationMessageForSeed } from "../CommunicationBuilder.js";

import { CommunicationExecutionService } from "./CommunicationExecutionService.js";
import { CommunicationProviderRegistry } from "./CommunicationProviderRegistry.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:10:00.000Z";

function makeQueuedMessageRuntime({ messageId = "cm_q_1", threadId = "ct_q_1", channel = "email" } = {}) {
  const rt = new CommunicationRuntime({ nowISO: NOW0 });

  const thread = buildCommunicationThreadForSeed({
    nowISO: NOW0,
    overrides: {
      id: threadId,
      subject: "Thread",
      channel,
      status: "draft",
      participants: [{ id: "tm_1", type: "human" }],
      messageIds: [],
      relatedObjects: [],
      createdAt: NOW0,
      updatedAt: NOW0,
      metadata: {},
    },
  });

  rt.applyEvent({
    id: "evt_thread_created_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread },
  });

  const message = buildCommunicationMessageForSeed({
    nowISO: NOW0,
    threadId,
    overrides: {
      id: messageId,
      direction: "outbound",
      channel,
      status: "draft",
      subject: "Hello",
      body: "Body",
      sender: { id: "tm_1", type: "human" },
      recipients: [{ id: "p_1", type: "external_system" }],
      createdAt: NOW0,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      relatedObjects: [],
      metadata: {},
    },
  });

  rt.applyEvent({
    id: "evt_msg_drafted_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message },
  });

  rt.applyEvent({
    id: "evt_msg_queued_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
    source: "test",
    payload: { messageId },
  });

  return rt;
}

test("Provider execution success: applies COMMUNICATION_MESSAGE_SENT and returns immutable result", async () => {
  const communicationRuntime = makeQueuedMessageRuntime({ messageId: "cm_exec_1", channel: "email" });

  let mutatedAttempt = false;
  const provider = {
    id: "prov_1",
    name: "Test Provider",
    supportedChannels: ["email"],
    health: "healthy",
    send: (message) => {
      // message and nested objects are deeply frozen. Attempting to mutate should not change runtime.
      try {
        (message.metadata).mutated = true;
      } catch (e) {
        mutatedAttempt = true;
      }

      return {
        providerMessageId: "prov_msg_123",
        status: "sent",
        sentAt: NOW1,
        metadata: { providerNote: "ok" },
      };
    },
  };

  const service = new CommunicationExecutionService();
  const before = JSON.stringify(communicationRuntime._state);

  const result = await service.execute({
    communicationRuntime,
    provider,
    messageId: "cm_exec_1",
    nowISO: NOW1,
  });

  assert.ok(Object.isFrozen(result));
  assert.equal(result.status, "success");
  assert.equal(result.providerMessageId, "prov_msg_123");
  assert.equal(result.communicationMessageId, "cm_exec_1");
  assert.equal(result.sentAt, NOW1);

  const msg = communicationRuntime.getMessage("cm_exec_1");
  assert.ok(msg);
  assert.equal(msg.status, "sent");
  assert.equal(msg.sentAt, NOW1);

  const after = JSON.stringify(communicationRuntime._state);
  assert.notEqual(after, before);
  assert.equal(mutatedAttempt, true);
});

test("Provider execution failure: applies COMMUNICATION_MESSAGE_FAILED when provider returns failed status", async () => {
  const communicationRuntime = makeQueuedMessageRuntime({ messageId: "cm_exec_fail_1", channel: "sms" });

  const provider = {
    id: "prov_fail",
    name: "Fail Provider",
    supportedChannels: ["sms"],
    health: "healthy",
    send: () => ({
      providerMessageId: "prov_msg_fail_1",
      status: "failed",
      sentAt: null,
      metadata: { reason: "bad number" },
    }),
  };

  const service = new CommunicationExecutionService();
  const result = await service.execute({
    communicationRuntime,
    provider,
    messageId: "cm_exec_fail_1",
    nowISO: NOW1,
  });

  assert.ok(Object.isFrozen(result));
  assert.equal(result.status, "failed");
  assert.equal(result.providerMessageId, "prov_msg_fail_1");

  const msg = communicationRuntime.getMessage("cm_exec_fail_1");
  assert.equal(msg.status, "failed");
  assert.equal(msg.failedAt, NOW1);
});

test("Provider execution failure: applies COMMUNICATION_MESSAGE_FAILED when provider.send throws", async () => {
  const communicationRuntime = makeQueuedMessageRuntime({ messageId: "cm_exec_throw_1", channel: "email" });

  const provider = {
    id: "prov_throw",
    name: "Throw Provider",
    supportedChannels: ["email"],
    health: "healthy",
    send: () => {
      throw new Error("transport error");
    },
  };

  const service = new CommunicationExecutionService();
  const result = await service.execute({
    communicationRuntime,
    provider,
    messageId: "cm_exec_throw_1",
    nowISO: NOW1,
  });

  assert.equal(result.status, "failed");
  const msg = communicationRuntime.getMessage("cm_exec_throw_1");
  assert.equal(msg.status, "failed");
  assert.equal(msg.failedAt, NOW1);
});

test("Unsupported channel: execute throws and does not mutate runtime", async () => {
  const communicationRuntime = makeQueuedMessageRuntime({ messageId: "cm_unsupported_1", channel: "email" });

  const provider = {
    id: "prov_no_email",
    name: "No Email Provider",
    supportedChannels: ["sms"],
    health: "healthy",
    send: () => ({ providerMessageId: "x", status: "sent", sentAt: NOW1, metadata: {} }),
  };

  const service = new CommunicationExecutionService();
  const before = JSON.stringify(communicationRuntime._state);

  await assert.rejects(() =>
    service.execute({
      communicationRuntime,
      provider,
      messageId: "cm_unsupported_1",
      nowISO: NOW1,
    }),
  );

  const after = JSON.stringify(communicationRuntime._state);
  assert.equal(after, before);
});

test("Missing message: execute throws", async () => {
  const communicationRuntime = makeQueuedMessageRuntime({ messageId: "cm_exists_1", channel: "email" });

  const provider = {
    id: "prov_1",
    name: "Provider",
    supportedChannels: ["email"],
    health: "healthy",
    send: () => ({ providerMessageId: "x", status: "sent", sentAt: NOW1, metadata: {} }),
  };

  const service = new CommunicationExecutionService();
  await assert.rejects(() =>
    service.execute({
      communicationRuntime,
      provider,
      messageId: "cm_missing_1",
      nowISO: NOW1,
    }),
  );
});

test("Provider registry: register/unregister/getProvider/getProvidersByChannel are deterministic", () => {
  const registry = new CommunicationProviderRegistry();

  const p1 = { id: "p1", name: "P1", supportedChannels: ["email"], health: "healthy", send: () => ({}) };
  const p2 = { id: "p2", name: "P2", supportedChannels: ["sms"], health: "healthy", send: () => ({}) };

  assert.equal(registry.register(p1).ok, true);
  assert.equal(registry.register(p2).ok, true);

  assert.ok(registry.getProvider("p1"));
  assert.equal(registry.getProvider("missing"), null);

  const emailProviders = registry.getProvidersByChannel("email");
  assert.equal(emailProviders.length, 1);
  assert.equal(emailProviders[0].id, "p1");

  const smsProviders = registry.getProvidersByChannel("sms");
  assert.equal(smsProviders.length, 1);
  assert.equal(smsProviders[0].id, "p2");

  const u = registry.unregister("p1");
  assert.equal(u.removed, true);
  assert.equal(registry.getProvider("p1"), null);
});

