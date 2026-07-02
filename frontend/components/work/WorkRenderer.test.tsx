import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkRenderer from "./WorkRenderer";
import WorkContextProvider from "./WorkContext";
import WorkSummary from "./WorkSummary";
import WorkLoading from "./WorkLoading";
import WorkErrorBoundary from "./WorkErrorBoundary";

const makeVm = () =>
  ({
    viewId: "vm_work_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Work is steady and ready for next execution.",
    queues: [
      {
        id: "queue_needs_review",
        name: "Needs Review",
        summary: "2 items awaiting review",
        type: "review",
        priority: "high",
        itemCount: 2,
        items: ["wi_1", "wi_2"],
        status: "review_required",
        actions: [],
        metadata: {},
      },
    ],
    stages: [
      {
        id: "stage_review",
        name: "Review",
        summary: "Assess work requirements",
        status: "active",
        sortOrder: 2,
        itemCount: 2,
        items: ["wi_1", "wi_2"],
        metadata: {},
      },
    ],
    items: [
      {
        id: "wi_1",
        title: "Review communication draft",
        description: "Ensure message meets governance requirements.",
        workType: "communications",
        status: "review_required",
        priority: "medium",
        stage: { id: "stage_review", name: "Review" },
        queue: { id: "queue_needs_review", name: "Needs Review" },
        assignedTo: "tm_ceo",
        owner: "owner_1",
        dueAt: "2026-06-30T00:00:00.000Z",
        age: "1d",
        blockedReason: null,
        attentionRequired: true,
        nextAction: "review_work",
        relatedObjects: [],
        badges: ["Review required"],
        actions: [],
        metadata: {},
      },
    ],
    assignments: [
      {
        id: "wa_1",
        workItemId: "wi_1",
        assigneeId: "tm_ceo",
        assigneeName: "CEO",
        assigneeType: "human",
        assignedAt: "2026-07-01T00:00:00.000Z",
        status: "active",
        metadata: {},
      },
    ],
    attention: {
      summary: "1 attention item detected.",
      items: [
        {
          id: "att_1",
          category: "review_required_work",
          priority: "immediate",
          summary: "Review communication draft needs review.",
          metadata: { workItemId: "wi_1" },
        },
      ],
      metadata: {},
    },
    recommendedActions: [
      {
        id: "act_1",
        label: "Review Work",
        type: "review_work",
        target: "wi_1",
        priority: "immediate",
        style: "danger",
        disabled: false,
        metadata: {},
      },
    ],
    metrics: {
      totalWork: 1,
      openWork: 1,
      completedWork: 0,
      blockedWork: 0,
      reviewRequiredWork: 1,
      overdueWork: 0,
      assignedWork: 1,
      unassignedWork: 0,
      attentionCount: 1,
    },
    metadata: { layout: "single" },
  }) as any;

test("Renderer: renders summary, queues, stages, items, assignments, attention, and recommendations", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Queues"));
  assert.ok(html.includes("Needs Review"));
  assert.ok(html.includes("Stages"));
  assert.ok(html.includes("Review"));
  assert.ok(html.includes("Work items"));
  assert.ok(html.includes("Review communication draft"));
  assert.ok(html.includes("Assignments"));
  assert.ok(html.includes("CEO"));
  assert.ok(html.includes("Attention"));
  assert.ok(html.includes(vm.attention.items[0].summary));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes(vm.recommendedActions[0].label));
});

test("Summary: renders executive empty attention copy when no attention items", () => {
  const vm = makeVm();
  vm.attention.items = [];
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes("No work requires immediate attention."));
});

test("Queue rendering: empty queues show configured message", () => {
  const vm = makeVm();
  vm.queues = [];
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes("No work queues have been configured."));
});

test("Stage rendering: empty stages show configured message", () => {
  const vm = makeVm();
  vm.stages = [];
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes("No work stages have been configured."));
});

test("Work items: empty items show immediate attention copy", () => {
  const vm = makeVm();
  vm.items = [];
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes("No work requires immediate attention."));
});

test("Recommendations empty: renders progressing normally", () => {
  const vm = makeVm();
  vm.recommendedActions = [];
  const html = renderToStaticMarkup(<WorkRenderer viewModel={vm} />);
  assert.ok(html.includes("Your work is progressing normally."));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<WorkLoading />);
  const b = renderToStaticMarkup(<WorkLoading />);
  assert.deepEqual(a, b);
  assert.ok(a.includes("animate-pulse"));
});

test("Context: WorkSummary reads from WorkContext", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <WorkContextProvider viewModel={vm}>
      <WorkSummary />
    </WorkContextProvider>,
  );
  assert.ok(html.includes(vm.summary));
});

test("Error boundary: fallback renders when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };

  const html = renderToStaticMarkup(
    <WorkErrorBoundary>
      <Thrower />
    </WorkErrorBoundary>,
  );

  assert.ok(html.includes("Something went wrong while rendering work"));
});

