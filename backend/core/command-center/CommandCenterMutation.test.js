import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { composeBusinessCommandCenter } from "./BusinessCommandCenterComposer.js";
import { getDefaultIndustryPackageRegistry } from "../industries/IndustryPackageRegistry.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { runWebsiteInquiryOnWorkspace } from "../integration/HorizonPropertiesDemoBootstrap.js";
import { configureHorizonPropertiesWorkspace } from "../integration/HorizonPropertiesWorkspaceConfigurator.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { resetHorizonDemoWorkspace } from "../integration/HorizonDemoBootstrapRegistry.js";
import { getHorizonTaylorPartyId } from "../integration/FirstClientOperatingLoopRunner.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";

const NOW = "2026-07-01T00:00:00.000Z";

function composeFor(result) {
  const pkg = getDefaultIndustryPackageRegistry().getPackage(PROPERTY_MANAGEMENT_PACKAGE_ID);
  return composeBusinessCommandCenter({
    identityViewModel: result.identityViewModel,
    readinessReport: result.readinessReport,
    connectedSystemsSnapshot: result.connectedSystemsSnapshot,
    employeeReadinessReport: result.employeeReadinessReport,
    installationResult: result.installationResult,
    industryPackage: pkg,
    nowISO: NOW,
    ctx: result.ctx,
  });
}

function composeFromStack(stack, integrationPlatform) {
  const demoCfg = buildHorizonPropertiesDemoConfiguration();
  const employeeReadinessReport = buildDigitalEmployeeReadinessReport({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    capabilityRuntime: stack.capabilityRuntime,
    companyRuntime: stack.companyRuntime,
    connectedSystemsSnapshot: buildConnectedSystemsSnapshot({
      installationResult: stack.installationResult,
      connectionRuntime: integrationPlatform?.connectionRuntime,
    }),
    connectionRuntime: integrationPlatform?.connectionRuntime,
    teamRuntime: stack.teamRuntime,
  });
  return composeBusinessCommandCenter({
    identityViewModel: { businessName: demoCfg.companyName, industryDisplayName: "Property Management" },
    readinessReport: { readinessStatus: "READY" },
    connectedSystemsSnapshot: buildConnectedSystemsSnapshot({
      installationResult: stack.installationResult,
      connectionRuntime: integrationPlatform?.connectionRuntime,
    }),
    employeeReadinessReport,
    installationResult: stack.installationResult,
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    nowISO: NOW,
    ctx: stack,
  });
}

test("MUTATION A — zero business inputs: empty operating dashboard", () => {
  const result = activateWorkspace({
    workspaceId: "ws_mut_zero",
    nowISO: NOW,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      packageConfiguration: buildHorizonPropertiesDemoConfiguration(),
      demoConfigurationId: null,
    },
  });
  const cc = composeFor(result);
  const inbound = Number(cc.pulse.find((m) => m.id === "new_inquiries")?.value ?? 0);
  assert.equal(inbound, 0);
  assert.equal(cc.businessEpisodes.filter((e) => e.primaryParty?.id === getHorizonTaylorPartyId()).length, 0);
  assert.ok(!JSON.stringify(cc).includes("Invalid Date"));
  assert.ok(cc.hero.summary.length > 0);
  const needsYou = Number(cc.pulse.find((m) => m.id === "needs_attention")?.value ?? 0);
  const waitingState = cc.operatingStates.states.find((s) => s.id === "waiting_human")?.count ?? 0;
  assert.equal(needsYou, cc.needsYourAttention.length);
  assert.equal(waitingState, cc.needsYourAttention.length);
});

test("MUTATION B — one form input only: single inquiry facts", () => {
  const workspaceId = "ws_mut_one";
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration: buildHorizonPropertiesDemoConfiguration(),
  });
  installPackageEmployees({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    humanTeamMembers: buildHorizonPropertiesDemoConfiguration().humanTeamMembers,
    teamRuntime: stack.teamRuntime,
    nowISO: NOW,
  });
  configureHorizonPropertiesWorkspace({ stack, nowISO: NOW });
  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO: NOW,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });
  runWebsiteInquiryOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO: NOW });

  const cc = composeFromStack(stack, integrationPlatform);
  assert.equal(Number(cc.pulse.find((m) => m.id === "new_inquiries")?.value ?? 0), 1);
  assert.equal(cc.needsYourAttention.filter((a) => a.sourceType === "approval").length, 0);
  assert.equal(cc.needsYourAttention.filter((a) => a.title?.includes("Maintenance")).length, 0);
});

test("MUTATION C — counts change when second inquiry added", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_mut_two" });
  const result = activateWorkspace({
    workspaceId: "ws_mut_two",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });
  const cc = composeFor(result);
  const inbound = Number(cc.pulse.find((m) => m.id === "new_inquiries")?.value ?? 0);
  assert.ok(inbound >= 2, `expected >=2 inquiries, got ${inbound}`);
});

test("MUTATION D — blocked acknowledgment: response count does not claim unsent ack", () => {
  const workspaceId = "ws_mut_block_ack";
  const demoCfg = {
    ...buildHorizonPropertiesDemoConfiguration(),
    communicationChannels: {
      email: { status: "not_connected" },
      sms: { status: "not_connected" },
      voice: { status: "not_connected" },
    },
  };
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration: demoCfg,
  });
  installPackageEmployees({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    humanTeamMembers: demoCfg.humanTeamMembers,
    teamRuntime: stack.teamRuntime,
    nowISO: NOW,
  });
  configureHorizonPropertiesWorkspace({ stack, nowISO: NOW });
  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO: NOW,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });
  runWebsiteInquiryOnWorkspace({ stack, integrationPlatform, workspaceId, nowISO: NOW });
  const cc = composeFromStack(stack, integrationPlatform);
  const responses = Number(cc.pulse.find((m) => m.id === "responses_sent")?.value ?? 0);
  assert.equal(responses, 0);
  const ep = cc.businessEpisodes.find((e) => e.primaryParty?.id === getHorizonTaylorPartyId());
  if (ep) {
    assert.ok(!ep.whatVibeTechHandled.some((s) => s.stepKind === "acknowledgment_sent"));
  }
});

test("MUTATION E — inquiry without subject produces no subject match step", () => {
  const workspaceId = "ws_mut_no_subject";
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration: buildHorizonPropertiesDemoConfiguration(),
  });
  const integrationPlatform = createIntegrationPlatform({
    workspaceId,
    installationResult: stack.installationResult,
    communicationRuntime: stack.communicationRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    nowISO: NOW,
    platformEventBus: stack.bus,
    platformEventStore: stack.store,
  });
  integrationPlatform.webhookIngressService.ingest({
    providerId: "provider_mock_form",
    payload: {
      formId: "horizon_inquiry",
      submissionId: "form_sub_no_subject",
      name: "Pat Lee",
      email: "pat.lee@example.com",
      source: "website",
      message: "General question",
      submittedAt: NOW,
    },
  });
  const cc = composeFromStack(stack, integrationPlatform);
  const ep = cc.businessEpisodes.find((e) => e.primaryParty?.displayName === "Pat Lee");
  if (ep) {
    assert.equal(ep.primarySubject, null);
    assert.ok(!ep.whatVibeTechHandled.some((s) => s.stepKind === "subject_matched"));
  }
});

test("MUTATION F — approval decision changes attention and continuation", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_mut_approval" });
  const result = activateWorkspace({
    workspaceId: "ws_mut_approval",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });
  const before = composeFor(result);
  const pending = result.ctx.approvalRuntime.getRequests().find((a) => a.status === "PENDING");
  assert.ok(pending);
  assert.ok(before.needsYourAttention.some((a) => a.approvalId === pending.id));
  assert.ok(before.autonomousContinuation.some((c) => c.blocker));

  result.operationalBoundary.processOwnerApprovalDecision({ approvalId: pending.id, decision: "GRANT" });
  const after = composeFor(result);
  assert.equal(after.needsYourAttention.filter((a) => a.approvalId === pending.id).length, 0);
  assert.ok(!after.autonomousContinuation.some((c) => String(c.id).includes(`auto_approval_${pending.id}`)));
});

test("MUTATION F-reject — rejection removes approval attention without resuming automation", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_mut_reject" });
  const result = activateWorkspace({
    workspaceId: "ws_mut_reject",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });
  const pending = result.ctx.approvalRuntime.getRequests().find((a) => a.status === "PENDING");
  assert.ok(pending);
  const waitingBefore = result.ctx.automationRuntime.getRuns().filter((r) => r.status === "WAITING_FOR_APPROVAL").length;
  result.operationalBoundary.processOwnerApprovalDecision({ approvalId: pending.id, decision: "REJECT" });
  const after = composeFor(result);
  assert.equal(result.ctx.approvalRuntime.getRequestById(pending.id).status, "REJECTED");
  assert.equal(after.needsYourAttention.filter((a) => a.approvalId === pending.id).length, 0);
  const waitingAfter = result.ctx.automationRuntime.getRuns().filter((r) => r.status === "WAITING_FOR_APPROVAL").length;
  assert.ok(waitingAfter <= waitingBefore);
});
