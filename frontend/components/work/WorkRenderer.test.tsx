import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import WorkRenderer from "./WorkRenderer";
import WorkLoading from "./WorkLoading";
import WorkErrorBoundary from "./WorkErrorBoundary";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";

function renderWork(vm: any) {
  return renderToStaticMarkup(
    <BusinessScopeProvider
      value={{
        businessId: "biz_1",
        role: "owner",
        permissions: [],
        businessName: "Magna Mare",
      }}
    >
      <WorkRenderer viewModel={vm} />
    </BusinessScopeProvider>,
  );
}

const makeVm = () =>
  ({
    viewId: "vm_work_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Work needs attention: 1 overdue.",
    items: [
      {
        id: "wi_1",
        title: "Follow up with Alex Rivera",
        description: "Prospect follow-up for Harbor View.",
        workType: "prospect_follow_up",
        status: "in_progress",
        priority: "high",
        dueAt: "2026-06-30T00:00:00.000Z",
        metadata: {
          display: {
            workTypeLabel: "Prospect follow-up",
            statusLabel: "In progress",
            partyName: "Alex Rivera",
            subjectName: "12 Harbor View",
            subjectId: "sub_1",
            overdue: true,
            dueLabel: "Jun 30",
            nextStep: "Waiting for confirmation",
            engagementHref: "/engagement/party_1",
          },
        },
      },
    ],
    metrics: {
      totalWork: 1,
      openWork: 1,
      completedWork: 0,
      blockedWork: 0,
      reviewRequiredWork: 0,
      overdueWork: 1,
      assignedWork: 1,
      unassignedWork: 0,
      attentionCount: 1,
    },
    metadata: {},
  }) as any;

test("Renderer: renders executive work queue layout", () => {
  const vm = makeVm();
  const html = renderWork(vm);

  assert.ok(html.includes("Work"));
  assert.ok(html.includes("Work VIBETech is tracking across your business."));
  assert.ok(html.includes("Active work queue"));
  assert.ok(html.includes("Prospect follow-up"));
  assert.ok(html.includes("Follow up with Alex Rivera"));
  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("12 Harbor View"));
  assert.ok(html.includes("In progress"));
});

test("Renderer: shows compact empty state when no active work", () => {
  const vm = makeVm();
  vm.items = [];
  vm.metrics.openWork = 0;
  vm.metrics.overdueWork = 0;

  const html = renderWork(vm);
  assert.ok(html.includes("Work handled by your team and digital employees will appear here."));
});

test("Loading placeholders render deterministically", () => {
  const a = renderToStaticMarkup(<WorkLoading />);
  const b = renderToStaticMarkup(<WorkLoading />);
  assert.deepEqual(a, b);
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
