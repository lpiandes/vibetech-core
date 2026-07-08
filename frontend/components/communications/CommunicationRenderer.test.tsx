import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CommunicationRenderer from "./CommunicationRenderer";
import CommunicationThreadDetailLayout from "./CommunicationThreadDetailLayout";
import CommunicationLoading from "./CommunicationLoading";
import CommunicationErrorBoundary from "./CommunicationErrorBoundary";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import { WorkspaceNavigationProvider } from "@/components/workspace/WorkspaceNavigationContext";

function renderInbox(vm: any) {
  return renderToStaticMarkup(
    <BusinessScopeProvider
      value={{
        businessId: "biz_1",
        role: "owner",
        permissions: [],
        businessName: "Magna Mare",
      }}
    >
      <WorkspaceNavigationProvider>
        <CommunicationRenderer viewModel={vm} />
      </WorkspaceNavigationProvider>
    </BusinessScopeProvider>,
  );
}

const makeVm = () =>
  ({
    viewId: "vm_communications",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "1 thread requires attention.",
    threads: [
      {
        id: "ct_1",
        subject: "Re: Your inquiry to Magna Mare",
        channel: "email",
        status: "open",
        participants: [{ id: "party_1", type: "external_system", name: "Alex Rivera" }],
        messageCount: 1,
        latestMessageAt: "2026-07-01T00:00:00.000Z",
        relatedObjects: [],
        attentionRequired: false,
        badges: [],
        actions: [],
        metadata: {},
      },
    ],
    messages: [
      {
        id: "cm_1",
        threadId: "ct_1",
        direction: "outbound",
        channel: "email",
        status: "queued",
        sender: { id: "tm_ceo", type: "human", name: "Coordinator" },
        recipients: [{ id: "party_1", type: "external_system", name: "Alex Rivera" }],
        subject: "Re: Your inquiry",
        bodyPreview: "Thank you for contacting us about your inquiry.",
        createdAt: "2026-07-01T00:00:00.000Z",
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        relatedObjects: [],
        attentionRequired: false,
        badges: ["Queued"],
        actions: [],
        metadata: {},
      },
    ],
    participants: [],
    queues: [],
    attention: { summary: "No attention.", items: [], metadata: {} },
    recommendedActions: [],
    metrics: {
      totalThreads: 1,
      totalMessages: 1,
      draftMessages: 0,
      queuedMessages: 1,
      sentMessages: 0,
      failedMessages: 0,
      deliveredMessages: 0,
      receivedMessages: 0,
      attentionThreadCount: 0,
      attentionMessageCount: 0,
    },
    metadata: {},
  }) as any;

const makeDetail = () =>
  ({
    thread: {
      id: "ct_1",
      subject: "Re: Your inquiry to Magna Mare",
      channel: "email",
      status: "open",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      latestMessageAt: "2026-07-01T00:00:00.000Z",
    },
    messages: [
      {
        id: "cm_1",
        direction: "outbound",
        channel: "email",
        status: "queued",
        subject: "Re: Your inquiry",
        body: "Thank you for contacting Magna Mare.",
        createdAt: "2026-07-01T00:00:00.000Z",
        sentAt: null,
        deliveredAt: null,
        failedAt: null,
        timestamp: "2026-07-01T00:00:00.000Z",
      },
    ],
    contact: {
      partyId: "party_1",
      displayName: "Alex Rivera",
      email: "alex@example.com",
    },
    inquiry: {
      requestId: "req_1",
      requestType: "PROSPECT_INQUIRY",
      text: "Looking for a 2-bedroom near downtown.",
      receivedAt: "2026-07-01T00:00:00.000Z",
    },
    subject: {
      id: "sub_1",
      subjectType: "RENTAL_LISTING",
      displayName: "12 Harbor View",
      status: "active",
      address: "12 Harbor View Dr",
    },
    interaction: null,
  }) as const;

test("CommunicationRenderer: renders executive inbox layout", () => {
  const html = renderInbox(makeVm());

  assert.ok(html.includes("Inbox"));
  assert.ok(html.includes("Messages and follow-ups VIBETech is tracking for this business."));
  assert.ok(html.includes("Conversations"));
  assert.ok(html.includes("Queued"));
  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("Thank you for contacting us about your inquiry."));
  assert.ok(html.includes("/b/biz_1/inbox/ct_1"));
});

test("CommunicationRenderer: compact empty state when no conversations", () => {
  const vm = makeVm();
  vm.threads = [];
  vm.messages = [];
  vm.metrics.totalThreads = 0;
  vm.metrics.queuedMessages = 0;

  const html = renderInbox(vm);
  assert.ok(html.includes("Messages from connected email, text, and other channels will appear here."));
});

test("CommunicationThreadDetailLayout: renders contact, inquiry, outbound response, and property interest", () => {
  const html = renderToStaticMarkup(
    <CommunicationThreadDetailLayout businessId="biz_1" detail={makeDetail()} />,
  );

  assert.ok(html.includes("Inbox"));
  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("alex@example.com"));
  assert.ok(html.includes("Original inquiry"));
  assert.ok(html.includes("Looking for a 2-bedroom near downtown."));
  assert.ok(html.includes("Outbound response"));
  assert.ok(html.includes("Thank you for contacting Magna Mare."));
  assert.ok(html.includes("Property interest"));
  assert.ok(html.includes("12 Harbor View"));
  assert.ok(html.includes("Queued"));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<CommunicationLoading />);
  const b = renderToStaticMarkup(<CommunicationLoading />);
  assert.deepEqual(a, b);
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

  assert.ok(html.includes("Something went wrong while rendering executive communications."));
});
