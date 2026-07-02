import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CommunicationRenderer from "./CommunicationRenderer";
import CommunicationContextProvider from "./CommunicationContext";
import CommunicationSummary from "./CommunicationSummary";
import CommunicationLoading from "./CommunicationLoading";
import CommunicationErrorBoundary from "./CommunicationErrorBoundary";

const makeVm = () =>
  ({
    viewId: "vm_communications",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "2 conversations require attention.",
    threads: [
      {
        id: "ct_1",
        subject: "Customer follow-up",
        channel: "email",
        status: "failed",
        participants: [],
        messageCount: 2,
        latestMessageAt: "2026-07-01T00:00:00.000Z",
        relatedObjects: [],
        attentionRequired: true,
        badges: ["Needs Attention"],
        actions: [{ id: "a_1", label: "Archive Thread", type: "archive_thread", target: "ct_1", priority: "later", style: "neutral", disabled: false, metadata: {} }],
        metadata: {},
      },
    ],
    messages: [
      {
        id: "cm_1",
        threadId: "ct_1",
        direction: "outbound",
        channel: "email",
        status: "failed",
        sender: { id: "tm_ceo", type: "human", name: "CEO", metadata: {} },
        recipients: [{ id: "p_1", type: "external_system", name: "Client", metadata: {} }],
        subject: "Failed follow-up",
        bodyPreview: "Body preview",
        createdAt: "2026-07-01T00:00:00.000Z",
        sentAt: null,
        deliveredAt: null,
        failedAt: "2026-07-01T00:00:00.000Z",
        relatedObjects: [],
        attentionRequired: true,
        badges: ["Failed"],
        actions: [{ id: "a_2", label: "Retry Message", type: "retry_message", target: "cm_1", priority: "immediate", style: "danger", disabled: false, metadata: {} }],
        metadata: {},
      },
    ],
    participants: [],
    queues: [
      {
        id: "q_needs_attention",
        name: "Needs Attention",
        summary: "1 thread(s) awaiting attention",
        type: "needs_attention",
        priority: "immediate",
        itemCount: 1,
        items: ["ct_1"],
        status: "open",
        actions: [],
        metadata: {},
      },
    ],
    attention: {
      summary: "1 thread(s) require attention.",
      items: [
        {
          id: "att_1",
          category: "failed_messages",
          priority: "immediate",
          summary: "Message cm_1 failed.",
          metadata: {},
        },
      ],
      metadata: {},
    },
    recommendedActions: [
      {
        id: "act_retry_1",
        label: "Retry Message",
        type: "retry_message",
        target: "cm_1",
        priority: "immediate",
        style: "danger",
        disabled: false,
        metadata: {},
      },
    ],
    metrics: {
      totalThreads: 1,
      totalMessages: 1,
      draftMessages: 0,
      queuedMessages: 0,
      sentMessages: 0,
      failedMessages: 1,
      deliveredMessages: 0,
      receivedMessages: 0,
      attentionThreadCount: 1,
      attentionMessageCount: 1,
    },
    metadata: {},
  }) as any;

test("CommunicationRenderer: renders summary, queues, threads, messages, attention, recommendations", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<CommunicationRenderer viewModel={vm} />);
  assert.ok(html.includes("Communications"));
  assert.ok(html.includes("Communication dashboard"));
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Queues"));
  assert.ok(html.includes("Needs Attention"));
  assert.ok(html.includes("Conversations"));
  assert.ok(html.includes("Customer follow-up"));
  assert.ok(html.includes("Messages"));
  assert.ok(html.includes("Failed follow-up"));
  assert.ok(html.includes("Needs attention"));
  assert.ok(html.includes(vm.attention.items[0].summary));
  assert.ok(html.includes("Recommended actions"));
  assert.ok(html.includes(vm.recommendedActions[0].label));
});

test("Context: CommunicationSummary reads from CommunicationViewModelContext", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <CommunicationContextProvider viewModel={vm}>
      <CommunicationSummary />
    </CommunicationContextProvider>,
  );
  assert.ok(html.includes("Communication dashboard"));
  assert.ok(html.includes(vm.summary));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<CommunicationLoading />);
  const b = renderToStaticMarkup(<CommunicationLoading />);
  assert.deepEqual(a, b);
  assert.ok(a.includes("animate-pulse"));
});

test("Empty attention: attention renderer shows executive empty copy", () => {
  const vm = makeVm();
  vm.attention.items = [];
  const html = renderToStaticMarkup(<CommunicationRenderer viewModel={vm} />);
  assert.ok(html.includes("No communications require immediate attention."));
});

test("Empty queues: queue renderer shows configured message", () => {
  const vm = makeVm();
  vm.queues = [];
  const html = renderToStaticMarkup(<CommunicationRenderer viewModel={vm} />);
  assert.ok(html.includes("No communication queues have been configured yet."));
});

test("Error boundary: fallback renders when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };
  const html = renderToStaticMarkup(
    <CommunicationErrorBoundary>
      <Thrower />
    </CommunicationErrorBoundary>,
  );
  assert.ok(html.includes("Something went wrong while rendering communication."));
});

