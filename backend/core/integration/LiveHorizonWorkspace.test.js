import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { bootstrapHorizonPropertiesDemo, runMissedCallSmsSuccessProof } from "./HorizonPropertiesDemoBootstrap.js";
import { configureHorizonPropertiesWorkspace } from "./HorizonPropertiesWorkspaceConfigurator.js";
import { resetHorizonDemoWorkspace } from "./HorizonDemoBootstrapRegistry.js";
import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { buildHorizonPropertiesDemoConfiguration } from "../../../industries/property-management/demo/HorizonPropertiesDemoConfig.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import {
  getHorizonTaylorPartyId,
  getHorizonTaylorRequestId,
  HORIZON_DEMO_EXACT_QUALIFICATION_NOTE,
  HORIZON_DEMO_FORM_SUBMISSION_ID,
} from "./FirstClientOperatingLoopRunner.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { RequestViewAdapter } from "../request/views/RequestViewAdapter.js";
import { WorkViewAdapter } from "../work/views/WorkViewAdapter.js";
import { TeamViewAdapter } from "../team/views/TeamViewAdapter.js";
import { composeBusinessCommandCenter } from "../command-center/BusinessCommandCenterComposer.js";
import { projectSegmentMembership } from "../segments/SegmentProjectionEngine.js";
import { EXTERNAL_ACTION_STATUSES } from "../integrations/actions/ExternalActionRequest.js";
import { INTEGRATION_CAPABILITIES } from "../integrations/capabilities/IntegrationCapability.js";
import { createExternalActionRequest } from "../integrations/actions/ExternalActionRequest.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";

const NOW = "2026-07-01T00:00:00.000Z";

function activateHorizon(workspaceId, nowISO = NOW) {
  resetHorizonDemoWorkspace({ workspaceId });
  return activateWorkspace({
    workspaceId,
    nowISO,
    activation: {
      industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
      demoConfigurationId: "horizon_properties",
    },
  });
}

function buildHorizonStack(workspaceId) {
  const stack = buildPropertyManagementWorkspaceStack({
    workspaceId,
    nowISO: NOW,
    installPackage: true,
    demoConfiguration: buildHorizonPropertiesDemoConfiguration(),
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
  return { stack, integrationPlatform };
}

test("LIVE: ws_horizon_properties activation produces canonical operating loop facts", () => {
  const result = activateHorizon("ws_horizon_live_canonical");
  const partyId = getHorizonTaylorPartyId();
  const requestId = getHorizonTaylorRequestId();
  const { ctx, demoBootstrap, integrationPlatform } = result;

  assert.equal(demoBootstrap.primaryPartyId, partyId);
  assert.equal(demoBootstrap.primaryRequestId, requestId);
  assert.ok(ctx.businessGraphRuntime.getParty(partyId));
  assert.ok(ctx.businessSubjectRuntime.getSubject("subj_horizon_unit_2b"));

  const request = ctx.requestRuntime.getRequest(requestId);
  assert.ok(request);
  assert.equal(request.inboundAttribution?.landingPage, "/units/2b");
  assert.equal(request.subjectRefs?.[0]?.entityId, "subj_horizon_unit_2b");

  const interaction = ctx.interactionRuntime.getInteraction(`int_qual_${HORIZON_DEMO_FORM_SUBMISSION_ID}`);
  assert.equal(interaction?.notes?.[0]?.text, HORIZON_DEMO_EXACT_QUALIFICATION_NOTE);
  assert.equal(interaction?.outcome, "showing_requested");
  assert.ok(ctx.automationRuntime.getRuns().length >= 1);

  const showingWork = ctx.workRuntime.getWorkItems().find((w) => String(w.workType) === "showing_coordination");
  assert.ok(showingWork);
  assert.ok(showingWork.assignedTo);

  const assignee = ctx.teamRuntime.getMembers().find((m) => String(m.id) === String(showingWork.assignedTo));
  assert.ok(assignee);
  assert.ok(assignee.workload.pendingWork >= 1, "WORK_ASSIGNED projected pending workload");

  const interested = ctx.segmentDefinitionRuntime.getDefinitions().find((d) => d.id === "interested_in_subject");
  const projection = projectSegmentMembership({
    segmentDefinition: interested,
    businessGraphRuntime: ctx.businessGraphRuntime,
    requestRuntime: ctx.requestRuntime,
    interactionRuntime: ctx.interactionRuntime,
    businessSubjectRuntime: ctx.businessSubjectRuntime,
    preferenceRuntime: ctx.communicationPreferenceRuntime,
  });
  assert.ok(projection.members.some((m) => m.entityId === partyId));

  assert.ok(ctx.analyticsRuntime.getDataPoints().length >= 1);

  const emailConn = integrationPlatform.connectionRuntime
    .getConnections()
    .find((c) => c.connectionType === "business_email");
  assert.equal(emailConn.status, CONNECTION_STATUSES.CONNECTED);
});

test("IDEMPOTENCY: repeated bootstrap does not duplicate business facts", () => {
  const workspaceId = "ws_horizon_live_idempotent";
  resetHorizonDemoWorkspace({ workspaceId });
  const { stack, integrationPlatform } = buildHorizonStack(workspaceId);

  bootstrapHorizonPropertiesDemo({ stack, integrationPlatform, workspaceId, nowISO: NOW });
  const countsBefore = snapshotCounts(stack);
  const second = bootstrapHorizonPropertiesDemo({ stack, integrationPlatform, workspaceId, nowISO: NOW });
  const countsAfter = snapshotCounts(stack);

  assert.equal(second.skipped, true);
  assert.deepEqual(countsAfter, countsBefore);
  assert.equal(stack.businessGraphRuntime.getParties().filter((p) => p.id === getHorizonTaylorPartyId()).length, 1);
});

test("CROSS-VIEW: same composition coheres across executive surfaces", () => {
  const result = activateHorizon("ws_horizon_live_coherence");
  const { ctx, identityViewModel, connectedSystemsSnapshot, installationResult, integrationPlatform } = result;
  const partyId = getHorizonTaylorPartyId();

  const engagement = new EngagementViewAdapter({ nowISO: NOW }).translate({
    partyId,
    businessGraphRuntime: ctx.businessGraphRuntime,
    businessSubjectRuntime: ctx.businessSubjectRuntime,
    communicationPreferenceRuntime: ctx.communicationPreferenceRuntime,
    segmentDefinitionRuntime: ctx.segmentDefinitionRuntime,
    requestRuntime: ctx.requestRuntime,
    workRuntime: ctx.workRuntime,
    communicationRuntime: ctx.communicationRuntime,
    interactionRuntime: ctx.interactionRuntime,
    automationRuntime: ctx.automationRuntime,
    approvalRuntime: ctx.approvalRuntime,
    platformEventStore: ctx.platformEventStore,
    analyticsRuntime: ctx.analyticsRuntime,
  });

  const requestView = new RequestViewAdapter({ nowISO: NOW }).translate({
    requestRuntime: ctx.requestRuntime,
    companyRuntime: ctx.companyRuntime,
    teamRuntime: ctx.teamRuntime,
    workRuntime: ctx.workRuntime,
  });
  const workView = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: ctx.workRuntime,
    teamRuntime: ctx.teamRuntime,
    companyRuntime: ctx.companyRuntime,
  });
  const teamView = new TeamViewAdapter({ nowISO: NOW }).translate({
    teamRuntime: ctx.teamRuntime,
    companyRuntime: ctx.companyRuntime,
    companyBrief: { companyId: "horizon" },
  });
  const commandCenter = composeBusinessCommandCenter({
    identityViewModel,
    readinessReport: result.readinessReport,
    connectedSystemsSnapshot,
    installationResult,
    integrationPlatform,
    nowISO: NOW,
    ctx,
  });

  assert.ok(engagement.subjects.some((s) => String(s.displayName).includes("Unit 2B")));
  assert.ok(
    requestView.items.some((r) => r.id === getHorizonTaylorRequestId() || String(r.title).toLowerCase().includes("inquiry")),
  );
  assert.ok(workView.items.some((w) => String(w.workType) === "showing_coordination"));
  assert.ok(teamView.members.some((m) => (m.workload?.pendingWork ?? 0) >= 1));
  assert.ok((commandCenter.businessActivity ?? []).length >= 1);
  assert.ok(engagement.segmentMemberships.length >= 1);
});

test("SMS: disconnected blocks, demo verified connection succeeds", async () => {
  const workspaceId = "ws_horizon_live_sms";
  const { stack, integrationPlatform } = buildHorizonStack(workspaceId);
  const smsConn = integrationPlatform.connectionRuntime
    .getConnections()
    .find((c) => c.connectionType === "sms_channel");
  assert.ok(smsConn);
  assert.notEqual(smsConn.status, CONNECTION_STATUSES.CONNECTED);

  const blocked = await integrationPlatform.actionOrchestrator.execute(
    createExternalActionRequest({
      id: "action_sms_blocked_test",
      workspaceId,
      capability: INTEGRATION_CAPABILITIES.SEND_SMS,
      connectionId: smsConn.id,
      parameters: { partyId: getHorizonTaylorPartyId() },
      idempotencyKey: "sms_blocked_test_key",
    }),
  );
  assert.equal(blocked.status, EXTERNAL_ACTION_STATUSES.BLOCKED);

  bootstrapHorizonPropertiesDemo({ stack, integrationPlatform, workspaceId, nowISO: NOW });
  const success = await runMissedCallSmsSuccessProof({ stack, integrationPlatform, workspaceId, nowISO: NOW });
  assert.notEqual(success.status, EXTERNAL_ACTION_STATUSES.BLOCKED);
});

test("WORKSPACE ISOLATION: non-Horizon workspace has no Taylor facts", () => {
  activateHorizon("ws_horizon_live_isolation_a");
  const other = activateWorkspace({ workspaceId: "ws_other_pm_client", nowISO: NOW });
  assert.equal(other.ctx.businessGraphRuntime.getParty(getHorizonTaylorPartyId()), null);
  assert.equal(other.ctx.requestRuntime.getRequest(getHorizonTaylorRequestId()), null);
});

function snapshotCounts(stack) {
  return {
    parties: stack.businessGraphRuntime.getParties().length,
    requests: stack.requestRuntime.getRequests().length,
    interactions: stack.interactionRuntime.getInteractions().length,
    communications: stack.communicationRuntime.getMessages?.()?.length ?? 0,
    automationRuns: stack.automationRuntime.getRuns().length,
    workItems: stack.workRuntime.getWorkItems().length,
    analytics: stack.analyticsRuntime.getDataPoints().length,
  };
}
