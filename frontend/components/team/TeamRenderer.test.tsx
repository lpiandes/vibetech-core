import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TeamRenderer from "./TeamRenderer";
import TeamLoading from "./TeamLoading";
import TeamErrorBoundary from "./TeamErrorBoundary";

const makeVm = () =>
  ({
    viewId: "vm_team_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Team overview: calm execution and steady coverage.",
    members: [
      {
        id: "tm_1",
        name: "CEO",
        memberType: "human",
        department: { id: "dept_1", name: "Executive" },
        role: { id: "role_1", name: "Chief Executive Officer" },
        status: "available",
        availability: 70,
        workload: { assignedWork: 2, pendingWork: 1, completedWork: 5 },
        capacity: 70,
        currentWork: [],
        attentionRequired: false,
        performanceSummary: "Ready and available.",
        badges: ["Available"],
        actions: [],
        metadata: {},
      },
      {
        id: "tm_2",
        name: "Support Lead",
        memberType: "human",
        department: { id: "dept_2", name: "Support" },
        role: { id: "role_2", name: "Support Lead" },
        status: "busy",
        availability: 50,
        workload: { assignedWork: 4, pendingWork: 3, completedWork: 2 },
        capacity: 50,
        currentWork: [],
        attentionRequired: true,
        performanceSummary: "Pending work needs review.",
        badges: ["Busy"],
        actions: [],
        metadata: {},
      },
    ],
    departments: [
      {
        id: "dept_1",
        name: "Executive",
        summary: "1 active member, 0 blocked.",
        status: "healthy",
        memberCount: 1,
        activeCount: 1,
        blockedCount: 0,
        workload: { assignedWork: 2, pendingWork: 1, completedWork: 5, utilization: 0 },
        members: ["tm_1"],
        actions: [],
        metadata: {},
      },
      {
        id: "dept_2",
        name: "Support",
        summary: "1 active member, 0 blocked.",
        status: "healthy",
        memberCount: 1,
        activeCount: 1,
        blockedCount: 0,
        workload: { assignedWork: 4, pendingWork: 3, completedWork: 2, utilization: 0 },
        members: ["tm_2"],
        actions: [],
        metadata: {},
      },
    ],
    workload: {
      totalMembers: 2,
      activeMembers: 2,
      blockedMembers: 0,
      availableMembers: 1,
      busyMembers: 1,
      offlineMembers: 0,
      totalAssignedWork: 6,
      totalPendingWork: 4,
      totalCompletedWork: 7,
      utilization: 42,
      metadata: {},
    },
    attention: {
      summary: "1 attention item detected.",
      items: [
        {
          id: "att_1",
          category: "overloaded_members",
          priority: "soon",
          summary: "Support Lead has pending work requiring review.",
          metadata: { memberId: "tm_2" },
        },
      ],
      metadata: {},
    },
    recommendations: [
      {
        id: "rec_1",
        label: "Rebalance Workload",
        type: "TEAM",
        target: "team",
        priority: "soon",
        style: "warning",
        disabled: false,
        metadata: {},
      },
    ],
    metadata: { layout: "single" },
  }) as any;

test("Renderer: renders workforce cockpit sections", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Team OS"));
  assert.ok(html.includes("Workforce Pulse"));
  assert.ok(html.includes("Departments"));
  assert.ok(html.includes("People"));
  assert.ok(html.includes("CEO"));
  assert.ok(html.includes("Support Lead"));
  assert.ok(html.includes("Attention"));
  assert.ok(html.includes(vm.attention.items[0].summary));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes(vm.recommendations[0].label));
  assert.ok(html.includes("Next:"));
});

test("Departments empty state uses executive language", () => {
  const vm = makeVm();
  vm.departments = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("Your department coverage will appear as roles are configured."));
});

test("People empty state uses executive language", () => {
  const vm = makeVm();
  vm.members = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("People cards will appear as capacity is measured."));
});

test("Attention empty state uses executive language", () => {
  const vm = makeVm();
  vm.attention.items = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("Your workforce is operating smoothly."));
});

test("Recommendations empty state uses executive language", () => {
  const vm = makeVm();
  vm.recommendations = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("No recommendations are currently pending."));
});

test("Loading placeholders: deterministic executive labels", () => {
  const htmlA = renderToStaticMarkup(<TeamLoading />);
  const htmlB = renderToStaticMarkup(<TeamLoading />);
  assert.deepEqual(htmlA, htmlB);
  assert.ok(htmlA.includes("Preparing workforce cockpit"));
});

test("Error boundary: fallback renders when child throws", () => {
  const Thrower = () => {
    throw new Error("render fail");
  };

  const html = renderToStaticMarkup(
    <TeamErrorBoundary>
      <Thrower />
    </TeamErrorBoundary>,
  );

  assert.ok(html.includes("Something went wrong while rendering Team"));
});

