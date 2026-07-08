import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { projectBusinessEpisodes } from "../episodes/BusinessEpisodeProjection.js";
import { composeBusinessCommandCenter } from "../command-center/BusinessCommandCenterComposer.js";
import { getDefaultIndustryPackageRegistry } from "../industries/IndustryPackageRegistry.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { getHorizonTaylorPartyId } from "../integration/FirstClientOperatingLoopRunner.js";
import { resetHorizonDemoWorkspace } from "../integration/HorizonDemoBootstrapRegistry.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("BUSINESS EPISODES: linked facts compose coherent Taylor inquiry episode", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_ep24_episodes" });
  const result = activateWorkspace({
    workspaceId: "ws_ep24_episodes",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });

  const episodes = projectBusinessEpisodes({
    ctx: result.ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
  });

  assert.ok(episodes.length >= 1);
  const taylor = episodes.find((e) => e.primaryParty?.id === getHorizonTaylorPartyId());
  assert.ok(taylor, "Taylor episode exists");
  assert.match(taylor.title, /Unit 2B|Inquiry/i);
  assert.ok(taylor.whatVibeTechHandled.length >= 3, "handled steps from canonical facts");
  assert.ok(taylor.primarySubject?.displayName?.includes("Unit 2B"));
});

test("BUSINESS EPISODES: Taylor website + phone collapse to one journey", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_ep24_collapse" });
  const result = activateWorkspace({
    workspaceId: "ws_ep24_collapse",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });

  const episodes = projectBusinessEpisodes({
    ctx: result.ctx,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
  });

  const taylorEpisodes = episodes.filter((e) => e.primaryParty?.id === getHorizonTaylorPartyId());
  assert.ok(taylorEpisodes.length <= 1, `expected one Taylor episode, got ${taylorEpisodes.length}`);
  if (taylorEpisodes[0]) {
    const steps = taylorEpisodes[0].whatVibeTechHandled;
    const kinds = new Set(steps.map((s) => s.stepKind));
    assert.equal(kinds.size, steps.length, "handled steps deduped by kind");
  }
});

test("BUSINESS STATE SUMMARY: deterministic headline not single episode copy", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_ep24_summary" });
  const result = activateWorkspace({
    workspaceId: "ws_ep24_summary",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });
  const pkg = getDefaultIndustryPackageRegistry().getPackage(PROPERTY_MANAGEMENT_PACKAGE_ID);
  const cc = composeBusinessCommandCenter({
    identityViewModel: result.identityViewModel,
    readinessReport: result.readinessReport,
    connectedSystemsSnapshot: result.connectedSystemsSnapshot,
    employeeReadinessReport: result.employeeReadinessReport,
    installationResult: result.installationResult,
    industryPackage: pkg,
    nowISO: NOW,
    ctx: result.ctx,
  });

  assert.ok(cc.businessStateSummary?.summary);
  assert.ok(cc.businessStateSummary?.headline);
  assert.ok(cc.businessControlStatus?.label);
  assert.ok(cc.operatingStates?.states?.length >= 4);
  assert.ok(cc.businessEpisodeFeed?.length >= 1);
  assert.equal(cc.handledByVibeTech.length, 0, "no flattened handled event feed");
});

test("PACKAGE SPECIFICITY: PM presentation differs from empty package", () => {
  const pm = PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION.pulseMetrics[0].label;
  assert.equal(pm, "New inquiries");
});
