import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import TeamRenderer from "./TeamRenderer";
import TeamLoading from "./TeamLoading";
import TeamErrorBoundary from "./TeamErrorBoundary";

const makeDigitalEmployees = () => [
  {
    employeeId: "pm_resident_prospect_coordinator",
    id: "pm_resident_prospect_coordinator",
    name: "Resident & Prospect Coordinator",
    role: "Resident & Prospect Coordinator",
    responsibility: "Resident & Prospect Coordinator",
    description: "Handles prospect inquiries, follow-ups, and resident communication",
    statusKey: "ACTIVE",
    statusLabel: "Ready",
    isReady: true,
    blockerItems: [],
    monitoring: [{ label: "Open assignments", count: 2 }],
    openAssignmentCount: 2,
    workHref: "/b/biz_1/work",
  },
  {
    employeeId: "pm_maintenance_coordinator",
    id: "pm_maintenance_coordinator",
    name: "Maintenance Coordinator",
    role: "Maintenance Coordinator",
    responsibility: "Maintenance Coordinator",
    description: "Coordinates maintenance requests, vendors, and inspections",
    statusKey: "CONFIGURING",
    statusLabel: "Needs setup",
    isReady: false,
    blockerItems: ["Connect required business channels"],
    setupHref: "/b/biz_1/integrations",
    monitoring: [],
  },
];

const makeVm = () =>
  ({
    viewId: "vm_team_1",
    companyId: "company_1",
    generatedAt: "2026-07-01T00:00:00.000Z",
    summary: "Team overview",
    members: [],
    departments: [],
    workload: { totalMembers: 0 },
    attention: { items: [] },
    recommendations: [],
    metadata: {},
    digitalEmployees: makeDigitalEmployees(),
  }) as any;

const makePlatformTeam = () => ({
  members: [
    { id: "u1", name: "Alex Rivera", email: "alex@magna.com", roleLabel: "Administrator" },
  ],
  pending: [{ id: "inv_1", email: "new@magna.com", roleLabel: "Team member" }],
  businessId: "biz_1",
  canInvite: true,
  canManage: true,
  showDevInviteLinks: false,
});

test("Renderer: team page uses executive shell sections and metrics", () => {
  const html = renderToStaticMarkup(<TeamRenderer viewModel={makeVm()} platformTeam={makePlatformTeam()} />);

  assert.ok(html.includes("Staff") || html.includes("workforce"));
  assert.ok(html.includes("People"));
  assert.ok(html.includes("Pending invites") || html.includes("Pending"));
  assert.ok(html.includes("AI teammates"));
  assert.ok(html.includes("Working") || html.includes("Ready") || html.includes("Active"));
});

test("Renderer: human team rows render role labels and contact details", () => {
  const html = renderToStaticMarkup(<TeamRenderer viewModel={makeVm()} platformTeam={makePlatformTeam()} />);

  assert.ok(html.includes("Alex Rivera"));
  assert.ok(html.includes("alex@magna.com"));
  assert.ok(html.includes("Administrator"));
});

test("Renderer: digital employees use role titles and blockers", () => {
  const html = renderToStaticMarkup(<TeamRenderer viewModel={makeVm()} platformTeam={makePlatformTeam()} />);

  assert.ok(html.includes("Resident & Prospect Coordinator"));
  assert.ok(html.includes("Maintenance Coordinator"));
  assert.ok(html.includes("Connect required business channels"));
  assert.ok(!html.includes("pm_resident_prospect_coordinator"));
  assert.ok(!html.includes("CONFIGURING"));
});

test("Renderer: compact empty human team state", () => {
  const html = renderToStaticMarkup(
    <TeamRenderer
      viewModel={makeVm()}
      platformTeam={{ ...makePlatformTeam(), members: [], pending: [] }}
    />,
  );

  assert.ok(html.includes("No staff yet") || html.includes("Invite"));
});

test("Loading placeholders: deterministic executive labels", () => {
  const htmlA = renderToStaticMarkup(<TeamLoading />);
  const htmlB = renderToStaticMarkup(<TeamLoading />);
  assert.deepEqual(htmlA, htmlB);
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
