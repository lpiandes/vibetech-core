import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TeamRenderer from "./TeamRenderer";
import TeamLoading from "./TeamLoading";
import TeamErrorBoundary from "./TeamErrorBoundary";
import TeamSummary from "./TeamSummary";
import TeamContextProvider from "./TeamContext";

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

test("Renderer: renders summary, departments, members, attention, and recommendations", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes(vm.summary));
  assert.ok(html.includes("Departments"));
  assert.ok(html.includes("Executive"));
  assert.ok(html.includes("Support"));
  assert.ok(html.includes("Members"));
  assert.ok(html.includes("CEO"));
  assert.ok(html.includes("Support Lead"));
  assert.ok(html.includes("Attention"));
  assert.ok(html.includes(vm.attention.items[0].summary));
  assert.ok(html.includes("Recommendations"));
  assert.ok(html.includes(vm.recommendations[0].label));
});

test("Summary: renders recommendation count and workload metrics", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <TeamContextProvider viewModel={vm}>
      <TeamSummary />
    </TeamContextProvider>,
  );
  assert.ok(html.includes("1 recommendation(s) queued."));
  assert.ok(html.includes("Utilization"));
  assert.ok(html.includes("42%"));
  assert.ok(html.includes("Availability"));
});

test("Department rendering: iterates viewModel.departments dynamically", () => {
  const vm = makeVm();
  vm.departments = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("No departments have been configured yet."));
});

test("Member rendering: iterates viewModel.members dynamically", () => {
  const vm = makeVm();
  vm.members = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("No team members have been added yet."));
});

test("Attention empty state: copy renders when attention.items is empty", () => {
  const vm = makeVm();
  vm.attention.items = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("Your team doesn't require immediate attention."));
});

test("Recommendations empty state: copy renders when recommendations is empty", () => {
  const vm = makeVm();
  vm.recommendations = [];
  const html = renderToStaticMarkup(<TeamRenderer viewModel={vm} />);
  assert.ok(html.includes("Everything is running smoothly."));
});

test("Loading placeholders: deterministic animate-pulse output", () => {
  const htmlA = renderToStaticMarkup(<TeamLoading />);
  const htmlB = renderToStaticMarkup(<TeamLoading />);
  assert.deepEqual(htmlA, htmlB);
  assert.ok(htmlA.includes("animate-pulse"));
});

test("Context: TeamSummary reads from TeamContext", () => {
  const vm = makeVm();
  const html = renderToStaticMarkup(
    <TeamContextProvider viewModel={vm}>
      <TeamSummary />
    </TeamContextProvider>,
  );
  assert.ok(html.includes(vm.summary));
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

