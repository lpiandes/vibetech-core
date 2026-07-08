import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { TeamViewAdapter } from "../team/views/TeamViewAdapter.js";
import { WorkViewAdapter } from "../work/views/WorkViewAdapter.js";
import { buildKnowledgeView } from "../workspace/views/KnowledgeViewBuilder.js";
import { composeBusinessCommandCenter } from "../command-center/BusinessCommandCenterComposer.js";
import { projectBusinessEpisodes } from "../episodes/BusinessEpisodeProjection.js";
import { buildPackagePageLabels } from "../industries/terminology/TerminologyResolver.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { CompanyWorkspaceRuntime, createABCPropertyGroupSeed } from "../company/CompanyWorkspaceRuntime.js";
import { WorkspaceGenerator } from "../workspace/WorkspaceGenerator.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

function buildHorizonStack() {
  return buildPropertyManagementWorkspaceStack({
    nowISO: NOW_ISO,
    workspaceId: "ws_horizon_properties",
    installPackage: true,
    demoConfiguration: buildHorizonPropertiesDemoConfiguration(),
  });
}

test("Team view: summary does not use recorded/Later framework language", () => {
  const stack = buildHorizonStack();
  const adapter = new TeamViewAdapter({ nowISO: NOW_ISO });
  const vm = adapter.translate({
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    workRuntime: stack.workRuntime,
    digitalEmployees: [],
  });
  const serialized = JSON.stringify(vm);
  assert.equal(serialized.includes("recorded Later"), false);
  assert.equal(serialized.includes("Status: recorded"), false);
  assert.equal(serialized.includes("Team attention required"), false);
  assert.equal(serialized.includes("Overall utilization"), false);
});

test("Team and Work open work counts align with WorkRuntime", () => {
  const stack = buildHorizonStack();
  const openFromRuntime = stack.workRuntime
    .getWorkItems()
    .filter((w) => !["completed", "cancelled", "closed"].includes(String(w.status ?? "").toLowerCase())).length;

  const teamVm = new TeamViewAdapter({ nowISO: NOW_ISO }).translate({
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    workRuntime: stack.workRuntime,
  });

  const workVm = new WorkViewAdapter({ nowISO: NOW_ISO }).translate({
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  const teamOpen = Number(teamVm.metadata?.openWorkCount ?? teamVm.workload?.totalPendingWork ?? 0);
  const workOpen = Number(workVm.metrics?.openWork ?? workVm.items?.length ?? 0);
  assert.equal(teamOpen, openFromRuntime);
  assert.equal(workOpen, openFromRuntime);
});

test("Knowledge view: operational when canonical knowledge items exist", () => {
  const runtime = new CompanyWorkspaceRuntime({ seed: createABCPropertyGroupSeed });
  const generator = new WorkspaceGenerator({ nowISO: NOW_ISO });
  const workspaceConfig = generator.generate({
    runtime,
    businessProfile: runtime.getBusinessProfile(),
    companyProfile: runtime.getCompanyProfile(),
    businessCapabilities: { overallReadiness: "READY", capabilities: [{ id: "knowledge", status: "READY" }] },
    nowISO: NOW_ISO,
  });

  const view = buildKnowledgeView({ workspaceConfig, runtime });
  assert.equal(view.operationalStatus, "operational");
  assert.equal(view.badges.some((b) => b.id === "disabled"), false);
  assert.equal(String(view.summary).includes("disabled"), false);
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes("recorded Later"), false);
  assert.equal(serialized.includes("recorded Soon"), false);
  assert.equal(serialized.includes("recorded Immediate"), false);
});

test("Episodes expose business-facing operatingStateLabel not raw waiting_human", () => {
  const stack = buildHorizonStack();
  const episodes = projectBusinessEpisodes({
    ctx: stack,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW_ISO,
  });
  for (const ep of episodes) {
    if (ep.operatingState === "waiting_human") {
      assert.equal(ep.operatingStateLabel, "Waiting on you");
    }
    assert.notEqual(ep.operatingStateLabel, "waiting_human");
  }
});

test("Package page labels use Needs decision for attention", () => {
  const labels = buildPackagePageLabels({
    industryPackage: { terminology: { pages: { attentionTitle: "Needs decision" } } },
  });
  assert.equal(labels.attention, "Needs decision");
});

test("Analytics executive layout is a client component", () => {
  const src = readFileSync(new URL("../../../frontend/components/analytics/AnalyticsExecutiveLayout.tsx", import.meta.url), "utf8");
  assert.ok(src.includes('"use client"'));
});

test("Digital workforce count is available for Team view when package employees exist", () => {
  const stack = buildHorizonStack();
  const employees = [
    { employeeId: "emp_1", name: "Taylor", role: "Coordination", status: "ACTIVE" },
    { employeeId: "emp_2", name: "Maria", role: "Maintenance", status: "ACTIVE" },
  ];
  const vm = new TeamViewAdapter({ nowISO: NOW_ISO }).translate({
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    workRuntime: stack.workRuntime,
    digitalEmployees: employees,
  });
  assert.equal(Number(vm.metadata?.digitalWorkforceCount ?? 0), 2);
});

test("Mission Control work rows include statusLabel presentation mapping", () => {
  const stack = buildHorizonStack();
  const cc = composeBusinessCommandCenter({
    identityViewModel: { businessName: "Horizon Properties" },
    readinessReport: { readinessStatus: "READY" },
    ctx: stack,
    installationResult: { executiveExperience: { dashboardPresentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } },
    nowISO: NOW_ISO,
  });
  for (const row of cc.workMovingNow ?? []) {
    if (row.status === "in_progress") {
      assert.equal(row.statusLabel, "In progress");
    }
    assert.notEqual(row.partyName && String(row.partyName).startsWith("party_"), true);
  }
});
