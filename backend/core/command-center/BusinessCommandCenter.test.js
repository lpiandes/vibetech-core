import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace } from "../workspace/activation/activateWorkspace.js";
import { composeBusinessCommandCenter } from "./BusinessCommandCenterComposer.js";
import { adaptBusinessCommandCenterView } from "./views/BusinessCommandCenterViewAdapter.js";
import { projectOwnerAttention } from "./OwnerAttentionProjection.js";
import { projectHandledByVibeTech } from "./HandledByVibeTechProjection.js";
import { mapEventToBusinessActivity, assertNoRawEventNamesInPresentation } from "../presentation/BusinessActivityLanguageMapper.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { createIndustryPackage } from "../industries/IndustryPackage.js";
import { IndustryPackageInstaller } from "../industries/IndustryPackageInstaller.js";
import { IndustryPackageInstallationRuntime } from "../industries/IndustryPackageInstallationRuntime.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";

test("Command Center composes for Horizon Properties with attention and handled sections", () => {
  const activated = activateWorkspace({
    workspaceId: "ws_horizon_command_center",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: "horizon_properties",
    },
  });
  const cc = composeBusinessCommandCenter({
    identityViewModel: activated.identityViewModel,
    readinessReport: activated.readinessReport,
    connectedSystemsSnapshot: activated.connectedSystemsSnapshot,
    employeeReadinessReport: activated.employeeReadinessReport,
    connectionDependencyProjection: activated.connectionDependencyProjection,
    integrationPlatform: activated.integrationPlatform,
    terminology: activated.installationResult?.terminology,
    installationResult: activated.installationResult,
    nowISO: NOW_ISO,
    ctx: activated.ctx,
  });

  assert.ok(cc.hero.businessName);
  assert.ok(Array.isArray(cc.needsYourAttention));
  assert.ok(Array.isArray(cc.handledByVibeTech));
  assert.ok(cc.digitalWorkforce.digitalEmployees.length > 0);

  const view = adaptBusinessCommandCenterView(cc, { pageLabels: activated.pageLabels });
  assert.equal(view.viewId, "business_command_center");
  assert.ok(view.needsYourAttention.length >= 0);

  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes("REQUEST_CONVERTED"), false);
  assert.equal(serialized.includes("WORK_CREATED"), false);
});

test("Owner attention excludes routine platform events", () => {
  const activated = activateWorkspace({
    workspaceId: "ws_horizon_attention",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: "horizon_properties",
    },
  });
  const attention = projectOwnerAttention({
    approvalRuntime: activated.ctx.approvalRuntime,
    workRuntime: activated.ctx.workRuntime,
    readinessReport: activated.readinessReport,
    connectedSystemsSnapshot: activated.connectedSystemsSnapshot,
    employeeReadinessReport: activated.employeeReadinessReport,
    automationRuntime: activated.ctx.automationRuntime,
    connectionDependencyProjection: activated.connectionDependencyProjection,
    integrationPlatform: activated.integrationPlatform,
    nowISO: NOW_ISO,
  });

  for (const item of attention) {
    assert.ok(item.title);
    assert.ok(item.reason);
    assert.ok(item.recommendedAction);
    assert.notEqual(item.sourceType, "routine_activity");
  }
});

test("Handled by VIBETech uses business-readable labels", () => {
  const activated = activateWorkspace({
    workspaceId: "ws_horizon_handled",
    nowISO: NOW_ISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: "horizon_properties",
    },
  });
  const handled = projectHandledByVibeTech({
    platformEventStore: activated.ctx.platformEventStore,
    terminology: activated.installationResult?.terminology,
  });

  for (const item of handled) {
    assert.ok(item.title);
    assert.notEqual(item.title, "REQUEST_CONVERTED");
    assert.ok(assertNoRawEventNamesInPresentation(item));
  }
});

test("Business activity language mapper never exposes raw event names in display", () => {
  const activity = mapEventToBusinessActivity({ eventType: "REQUEST_CONVERTED", payload: {} });
  assert.equal(activity.displayTitle, "Request converted to work");
  assert.notEqual(activity.displayTitle, "REQUEST_CONVERTED");
});

test("Universality: fixture package composes same Command Center structure", () => {
  const fixturePackage = createIndustryPackage({
    id: "pkg_fixture_ops",
    name: "Operations Fixture",
    description: "Minimal operations fixture for universality proof.",
    version: 1,
    terminology: { pages: { commandCenterTitle: "Ops Command Center" } },
    navigation: { modules: ["work", "team"] },
    capabilities: [],
    automationConfigurations: [],
    knowledgeCategories: [],
  });

  const stack = buildPropertyManagementWorkspaceStack({ nowISO: NOW_ISO, workspaceId: "ws_fixture", installPackage: false });
  const installer = new IndustryPackageInstaller({ installationRuntime: stack.installationRuntime });
  const installationResult = installer.install({
    industryPackage: fixturePackage,
    workspaceId: "ws_fixture",
    configuration: {},
    companyRuntime: stack.companyRuntime,
    capabilityRuntime: stack.capabilityRuntime,
    automationRuntime: stack.automationRuntime,
    nowISO: NOW_ISO,
  });

  const cc = composeBusinessCommandCenter({
    identityViewModel: { businessName: "Fixture Co", industryDisplayName: fixturePackage.name },
    readinessReport: { readinessStatus: "PARTIAL", summary: { automationsActive: 0 } },
    connectedSystemsSnapshot: { connections: [] },
    employeeReadinessReport: { employees: [] },
    nowISO: NOW_ISO,
    ctx: stack,
    installationResult,
  });

  assert.ok(cc.hero);
  assert.ok(cc.pulse);
  assert.ok(cc.whatHappensNext);
});
