import assert from "node:assert/strict";
import { test } from "node:test";

import { CommunicationRuntime } from "../CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "../CommunicationEventTypes.js";
import { buildCommunicationThreadForSeed, buildCommunicationMessageForSeed } from "../CommunicationBuilder.js";

import { WorkRuntime } from "../../work/WorkRuntime.js";
import { WORK_EVENT_TYPES } from "../../work/WorkEventTypes.js";
import { buildWorkItemForSeed } from "../../work/WorkBuilder.js";

import { TeamRuntime } from "../../team/TeamRuntime.js";
import { CompanyWorkspaceRuntime } from "../../company/CompanyWorkspaceRuntime.js";

import { CommunicationViewAdapter } from "./CommunicationViewAdapter.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-02T00:00:00.000Z";
const NOW2 = "2026-07-03T00:00:00.000Z";

function makeWorkRuntimeWithUnassignedWork() {
  const rt = new WorkRuntime({ nowISO: NOW0 });
  const workItem = buildWorkItemForSeed({
    nowISO: NOW0,
    overrides: {
      id: "wi_1",
      title: "Work linked to a communication",
      description: "Deterministic work item for enrichment.",
      workType: "communications",
      status: "new",
      priority: "medium",
      stageId: "stage_intake",
      queueId: "queue_needs_review",
      assignedTo: "unassigned",
      requestedBy: "owner",
      createdAt: NOW0,
      updatedAt: NOW0,
      requirements: [],
      relatedObjects: [],
      metadata: {},
      dueAt: null,
      source: "test",
    },
  });

  rt.applyEvent({
    id: "evt_work_created_1",
    timestampISO: NOW0,
    type: WORK_EVENT_TYPES.WORK_ITEM_CREATED,
    source: "test",
    payload: { workItem },
  });

  return rt;
}

function makeCommunicationRuntime({ nowISO } = {}) {
  const rt = new CommunicationRuntime({ nowISO: nowISO ?? NOW0 });

  const thread = buildCommunicationThreadForSeed({
    nowISO: nowISO ?? NOW0,
    overrides: {
      id: "ct_1",
      subject: "Customer follow-up",
      channel: "email",
      status: "draft",
      participants: [{ id: "tm_ceo", type: "human" }, { id: "p_buyer", type: "external_system" }],
      messageIds: [],
      relatedObjects: [{ workItemId: "wi_1" }],
      createdAt: NOW0,
      updatedAt: NOW0,
      metadata: {},
    },
  });

  rt.applyEvent({
    id: "evt_ct_created_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_THREAD_CREATED,
    source: "test",
    payload: { thread },
  });

  // Failed latest message.
  const failedMessage = buildCommunicationMessageForSeed({
    nowISO: NOW1,
    threadId: "ct_1",
    overrides: {
      id: "cm_failed_1",
      direction: "outbound",
      channel: "email",
      status: "draft",
      subject: "Failed follow-up",
      body: "Body",
      sender: { id: "tm_ceo", type: "human" },
      recipients: [{ id: "p_buyer", type: "external_system" }],
      relatedObjects: [{ workItemId: "wi_1" }],
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  rt.applyEvent({
    id: "evt_msg_drafted_failed_1",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message: failedMessage },
  });

  rt.applyEvent({
    id: "evt_msg_failed_1",
    timestampISO: NOW2,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_FAILED,
    source: "test",
    payload: { messageId: "cm_failed_1" },
  });

  // Queued too long message (createdAt older than threshold).
  const queuedOld = buildCommunicationMessageForSeed({
    nowISO: "2026-05-22T00:00:00.000Z",
    threadId: "ct_1",
    overrides: {
      id: "cm_queued_old_1",
      direction: "outbound",
      channel: "email",
      status: "draft",
      subject: "Queued old",
      body: "Body",
      sender: { id: "tm_ceo", type: "human" },
      recipients: [{ id: "p_buyer", type: "external_system" }],
      relatedObjects: [],
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  rt.applyEvent({
    id: "evt_msg_drafted_queued_old_1",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message: queuedOld },
  });

  rt.applyEvent({
    id: "evt_msg_queued_queued_old_1",
    timestampISO: NOW1,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_QUEUED,
    source: "test",
    payload: { messageId: "cm_queued_old_1" },
  });

  // Received inbound requiring response + missing recipients.
  const receivedMsg = buildCommunicationMessageForSeed({
    nowISO: NOW0,
    threadId: "ct_1",
    overrides: {
      id: "cm_received_missing_recipients_1",
      direction: "inbound",
      channel: "chat",
      status: "draft",
      subject: "Inbound",
      body: "Body",
      sender: null, // triggers unknown_sender
      recipients: [],
      relatedObjects: [],
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
    },
  });

  rt.applyEvent({
    id: "evt_msg_drafted_received_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_DRAFTED,
    source: "test",
    payload: { message: receivedMsg },
  });

  rt.applyEvent({
    id: "evt_msg_received_1",
    timestampISO: NOW0,
    type: COMMUNICATION_EVENT_TYPES.COMMUNICATION_MESSAGE_RECEIVED,
    source: "test",
    payload: { messageId: "cm_received_missing_recipients_1" },
  });

  return rt;
}

test("CommunicationViewAdapter: generates a frozen CommunicationViewModel and validates attention/actions", () => {
  const communicationRuntime = makeCommunicationRuntime({ nowISO: NOW0 });
  const workRuntime = makeWorkRuntimeWithUnassignedWork();
  const teamRuntime = new TeamRuntime();
  const companyRuntime = new CompanyWorkspaceRuntime();

  const beforeComms = JSON.stringify(communicationRuntime._state);
  const beforeWork = JSON.stringify(workRuntime._state);
  const beforeTeam = JSON.stringify(teamRuntime._state);
  const beforeCompany = JSON.stringify(companyRuntime._state);

  const adapter = new CommunicationViewAdapter({ nowISO: NOW0 });
  const vm = adapter.translate({
    communicationRuntime,
    workRuntime,
    teamRuntime,
    companyWorkspaceRuntime: companyRuntime,
  });

  assert.ok(Object.isFrozen(vm));
  assert.equal(vm.viewId, "vm_communications");
  assert.equal(vm.threads.length, 1);
  assert.equal(vm.messages.length, 3);
  assert.ok(Array.isArray(vm.queues));
  assert.ok(Array.isArray(vm.participants));
  assert.ok(Array.isArray(vm.recommendedActions));

  assert.equal(vm.metrics.totalThreads, 1);
  assert.equal(vm.metrics.totalMessages, 3);
  assert.equal(vm.metrics.attentionThreadCount, 1);
  assert.equal(vm.metrics.attentionMessageCount, 3);

  // Thread view attention + actions.
  const thread = vm.threads[0];
  assert.equal(thread.id, "ct_1");
  assert.equal(thread.attentionRequired, true);
  assert.ok(thread.badges.includes("Needs Attention"));
  assert.ok(thread.actions.some((a) => a.type === "archive_thread"));
  assert.ok(thread.actions.some((a) => a.type === "view_related_work"));
  assert.ok(thread.actions.some((a) => a.type === "assign_owner"));

  // Message view action expectations.
  const failedMsgView = vm.messages.find((m) => m.id === "cm_failed_1");
  assert.ok(failedMsgView.attentionRequired);
  assert.ok(failedMsgView.actions.some((a) => a.type === "retry_message"));

  const queuedOldView = vm.messages.find((m) => m.id === "cm_queued_old_1");
  assert.ok(queuedOldView.attentionRequired);
  assert.ok(queuedOldView.actions.some((a) => a.type === "review_message"));

  const receivedView = vm.messages.find((m) => m.id === "cm_received_missing_recipients_1");
  assert.ok(receivedView.attentionRequired);
  assert.ok(receivedView.actions.some((a) => a.type === "reply_to_message"));
  assert.ok(receivedView.actions.some((a) => a.type === "review_message"));

  // Queues should contain attention threads.
  const needsQueue = vm.queues.find((q) => q.id === "q_needs_attention");
  assert.ok(needsQueue);
  assert.ok(needsQueue.itemCount >= 1);
  assert.ok(needsQueue.items.includes("ct_1"));

  // Runtime non-mutation checks.
  assert.equal(JSON.stringify(communicationRuntime._state), beforeComms);
  assert.equal(JSON.stringify(workRuntime._state), beforeWork);
  assert.equal(JSON.stringify(teamRuntime._state), beforeTeam);
  assert.equal(JSON.stringify(companyRuntime._state), beforeCompany);
});

test("CommunicationViewAdapter: queues and recommendedActions are deterministic", () => {
  const communicationRuntime = makeCommunicationRuntime({ nowISO: NOW0 });
  const workRuntime = makeWorkRuntimeWithUnassignedWork();
  const teamRuntime = new TeamRuntime();
  const companyRuntime = new CompanyWorkspaceRuntime();

  const a = new CommunicationViewAdapter({ nowISO: NOW0 }).translate({
    communicationRuntime,
    workRuntime,
    teamRuntime,
    companyWorkspaceRuntime: companyRuntime,
  });
  const b = new CommunicationViewAdapter({ nowISO: NOW0 }).translate({
    communicationRuntime,
    workRuntime,
    teamRuntime,
    companyWorkspaceRuntime: companyRuntime,
  });

  assert.deepEqual(a.queues, b.queues);
  assert.deepEqual(a.recommendedActions, b.recommendedActions);
});

