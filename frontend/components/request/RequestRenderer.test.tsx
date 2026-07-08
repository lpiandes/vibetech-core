import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import RequestRenderer from "./RequestRenderer";
import RequestLoading from "./RequestLoading";
import RequestErrorBoundary from "./RequestErrorBoundary";

const makeVm = () =>
  ({
    viewId: "vm_request_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Requests are ready for triage.",
    queues: [
      {
        id: "queue_new_requests",
        name: "New Requests",
        summary: "1 request awaiting review",
        type: "new_requests",
        priority: "immediate",
        itemCount: 1,
        items: ["r_1"],
        status: "open",
        actions: [],
        metadata: {},
      },
    ],
    items: [
      {
        id: "r_1",
        title: "Customer inquiry",
        description: "Deterministic request item.",
        requestType: "inquiry",
        status: "received",
        priority: "high",
        channel: "api",
        source: "manual",
        requester: "owner",
        receivedAt: "2026-07-01T00:00:00.000Z",
        age: "0h",
        dueAt: null,
        qualificationStatus: null,
        assignedWorkId: null,
        assignedTeamMemberId: null,
        attentionRequired: true,
        nextAction: "review_request",
        badges: ["High Priority"],
        actions: [],
        metadata: {},
      },
    ],
    attention: {
      summary: "1 attention item detected.",
      items: [
        {
          id: "att_1",
          category: "new_unreviewed_requests",
          priority: "immediate",
          summary: "Customer inquiry needs review.",
          metadata: { requestId: "r_1" },
        },
      ],
      metadata: {},
    },
    recommendedActions: [
      {
        id: "act_reco_1",
        label: "Review Request",
        type: "review_request",
        target: "r_1",
        priority: "immediate",
        style: "danger",
        disabled: false,
        metadata: {},
      },
    ],
    metrics: {
      totalRequests: 1,
      newRequests: 1,
      qualifiedRequests: 0,
      convertedRequests: 0,
      closedRequests: 0,
      averageAgeMs: 0,
      attentionCount: 1,
    },
    metadata: { layout: "single" },
  }) as any;

test("RequestRenderer: renders executive opportunity cockpit sections", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<RequestRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Requests OS"));
  assert.ok(html.includes("Opportunity Pulse"));
  assert.ok(html.includes("Pipeline"));
  assert.ok(html.includes("Priority Opportunities"));
  assert.ok(html.includes("Pipeline Risks"));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes(vm.attention.items[0].summary));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes(vm.recommendedActions[0].label));
});

test("Attention empty state: renders calm executive language", () => {
  const vm = makeVm();
  vm.attention.items = [];
  const html = renderToStaticMarkup(<RequestRenderer viewModel={vm} />);
  assert.ok(html.includes("Opportunity flow is healthy.") || html.includes("No pipeline risks") || html.includes("Opportunity flow"));
});

test("Recommendations empty: renders executive recommendation empty copy", () => {
  const vm = makeVm();
  vm.recommendedActions = [];
  const html = renderToStaticMarkup(<RequestRenderer viewModel={vm} />);
  assert.ok(html.includes("No requests currently require executive intervention."));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<RequestLoading />);
  const b = renderToStaticMarkup(<RequestLoading />);
  assert.deepEqual(a, b);
  assert.ok(a.includes("Preparing opportunity cockpit"));
});

test("Error boundary: fallback renders when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };

  const html = renderToStaticMarkup(
    <RequestErrorBoundary>
      <Thrower />
    </RequestErrorBoundary>,
  );

  assert.ok(html.includes("Something went wrong while rendering requests"));
});

