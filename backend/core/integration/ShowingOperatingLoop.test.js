import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "./ProspectInquiryOperatingLoopService.js";
import {
  runMaintenanceRequestOperatingLoop,
  PM_MAINTENANCE_COORDINATOR_ID,
} from "./MaintenanceRequestOperatingLoopService.js";
import {
  runShowingCoordinationOperatingLoop,
  PM_RESIDENT_PROSPECT_COORDINATOR_ID,
  showingInteractionIdForRequest,
} from "./ShowingCoordinationOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { buildSubjectPortfolioProjection } from "../business-subject/views/buildSubjectPortfolioProjection.js";
import { presentDigitalWorkforce } from "../command-center/DigitalWorkforcePresentation.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildPmProspectCoordinatorPlatformCoverage } from "../platform/knowledge/PlatformKnowledgeReadinessBridge.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { TIMELINE_ITEM_TYPES } from "../engagement/EngagementDefaults.js";

const NOW = "2026-07-08T15:00:00.000Z";
const SUBJECT_TYPES = ["property", "listing", "unit"];

function buildOperatingStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Showing Loop Co",
    workspaceId,
  });
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: NOW,
    workspaceId,
    installPackage: true,
    demoConfiguration,
  });
  installPackageEmployees({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    humanTeamMembers: [],
    teamRuntime: stack.teamRuntime,
    nowISO: NOW,
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
  return { stack, integrationPlatform, workspaceId };
}

function buildCtx(stack) {
  return {
    businessSubjectRuntime: stack.businessSubjectRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    teamRuntime: stack.teamRuntime,
    approvalRuntime: stack.approvalRuntime,
    automationRuntime: stack.automationRuntime,
  };
}

function seedListing(stack, { id, displayName, address }) {
  return new RecordBusinessSubjectService().execute({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    workspaceId: stack.workspaceId,
    subjectInput: { id, subjectType: "listing", displayName, keyAttributes: { address } },
    nowISO: NOW,
    source: "test",
  });
}

function portfolioTotals(stack) {
  return buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  }).totals;
}

function sumMetric(analyticsRuntime, metricId) {
  return analyticsRuntime
    .getDataPointsByMetric(metricId)
    .reduce((sum, dp) => sum + Number(dp.value ?? 0), 0);
}

async function seedProspectInquiry({ stack, integrationPlatform, workspaceId, overrides = {} }) {
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  return runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Taylor Prospect",
      email: "taylor.showing@example.com",
      message: "Interested in scheduling a tour.",
      subjectId: "subj_showing_a",
      ...overrides,
    },
  });
}

async function requestShowing({ stack, workspaceId, requestId, note, preferredTiming }) {
  return runShowingCoordinationOperatingLoop({
    stack,
    workspaceId,
    nowISO: NOW,
    request: { requestId, note, preferredTiming },
  });
}

test("showing operating loop: prospect inquiry to showing coordination work", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_happy");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  assert.equal(prospect.ok, true);

  const beforeRequests = stack.requestRuntime.getRequests().length;
  const result = await requestShowing({
    stack,
    workspaceId,
    requestId: prospect.requestId,
    note: "Prospect wants to tour this week.",
    preferredTiming: "weekday evenings",
  });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(stack.requestRuntime.getRequests().length, beforeRequests);

  const interaction = stack.interactionRuntime.getInteraction(showingInteractionIdForRequest(prospect.requestId));
  assert.ok(interaction);
  assert.equal(interaction.outcome, "showing_requested");
  assert.match(interaction.notes[0].text, /Prospect wants to tour this week/);
  assert.match(interaction.notes[0].text, /Preferred timing: weekday evenings/);

  const work = result.showingCoordinationWork;
  assert.ok(work);
  assert.equal(String(work.workType), "showing_coordination");
  assert.equal(String(work.assignedTo), PM_RESIDENT_PROSPECT_COORDINATOR_ID);
});

test("showing operating loop: idempotent duplicate request", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_dup");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  const first = await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "First" });
  const second = await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "Second" });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(
    stack.workRuntime.getWorkItems().filter((w) => String(w.workType) === "showing_coordination").length,
    1,
  );
  assert.equal(
    stack.interactionRuntime.getInteractions().filter((i) => i.outcome === "showing_requested").length,
    1,
  );
});

test("showing operating loop: rejects non-prospect request", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_non_prospect");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const maintenance = await runMaintenanceRequestOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    request: {
      name: "Jordan Kim",
      email: "jordan@example.com",
      description: "Leak under sink",
      subjectId: "subj_showing_a",
      permissionToContact: true,
      urgency: "high",
    },
  });
  assert.equal(maintenance.ok, true);

  const result = await requestShowing({ stack, workspaceId, requestId: maintenance.requestId });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_request_type");
});

test("showing operating loop: rejects prospect inquiry without subject", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_no_subject");
  const prospect = await seedProspectInquiry({
    stack,
    integrationPlatform,
    workspaceId,
    overrides: { subjectId: undefined, email: "no.subject@example.com" },
  });
  assert.equal(prospect.ok, true);

  const result = await requestShowing({ stack, workspaceId, requestId: prospect.requestId });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "subject_required");
});

test("showing operating loop: rejects foreign request in another workspace", async () => {
  const a = buildOperatingStack("ws_showing_tenant_a");
  const b = buildOperatingStack("ws_showing_tenant_b");
  seedListing(a.stack, { id: "subj_showing_a", displayName: "A Property", address: "A" });

  const prospect = await seedProspectInquiry({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.workspaceId,
  });
  assert.equal(prospect.ok, true);

  const result = await requestShowing({
    stack: b.stack,
    workspaceId: b.workspaceId,
    requestId: prospect.requestId,
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "request_not_found");
});

test("showing operating loop: prospect inquiry metrics unchanged", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_metrics");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  const afterProspect = portfolioTotals(stack);
  assert.equal(afterProspect.totalInquiries, 1);

  await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "Ready for tour" });

  const afterShowing = portfolioTotals(stack);
  assert.equal(afterShowing.totalInquiries, afterProspect.totalInquiries);
  assert.equal(afterShowing.openInquiries, afterProspect.openInquiries);
  assert.equal(afterShowing.interestedProspects, afterProspect.interestedProspects);
});

test("showing operating loop: analytics increments work but not request volume", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_analytics");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  const requestBefore = sumMetric(stack.analyticsRuntime, "request_received_count");
  const workCreatedBefore = sumMetric(stack.analyticsRuntime, "work_created_count");
  const workAssignedBefore = sumMetric(stack.analyticsRuntime, "work_assigned_count");

  const result = await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "Tour requested" });
  assert.equal(result.ok, true);

  const requestAfter = sumMetric(stack.analyticsRuntime, "request_received_count");
  const workCreatedAfter = sumMetric(stack.analyticsRuntime, "work_created_count");
  const workAssignedAfter = sumMetric(stack.analyticsRuntime, "work_assigned_count");

  assert.equal(requestAfter, requestBefore);
  assert.equal(workCreatedAfter, workCreatedBefore + 1);
  assert.equal(workAssignedAfter, workAssignedBefore + 1);
});

test("showing operating loop: team monitoring reflects coordinator assignment", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_team");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "Coordinate tour" });

  const workforce = presentDigitalWorkforce({
    employeeReadinessReport: buildDigitalEmployeeReadinessReport({
      employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
      capabilityRuntime: stack.capabilityRuntime,
      companyRuntime: stack.companyRuntime,
      connectedSystemsSnapshot: buildConnectedSystemsSnapshot({
        installationResult: stack.installationResult,
        connectionRuntime: integrationPlatform.connectionRuntime,
      }),
      connectionRuntime: integrationPlatform.connectionRuntime,
      teamRuntime: stack.teamRuntime,
      platformKnowledgeCoverage: buildPmProspectCoordinatorPlatformCoverage(2),
    }),
    workRuntime: stack.workRuntime,
    automationRuntime: stack.automationRuntime,
    teamRuntime: stack.teamRuntime,
    presentation: PROPERTY_MANAGEMENT_PACKAGE.executiveExperience?.dashboardPresentation ?? {},
    nowISO: NOW,
  });

  const coordinator = workforce.digitalEmployees.find((e) => e.id === PM_RESIDENT_PROSPECT_COORDINATOR_ID);
  assert.ok(coordinator);
  assert.ok(coordinator.monitoring.some((m) => m.count >= 1));
  assert.notEqual(PM_MAINTENANCE_COORDINATOR_ID, coordinator.id);
});

test("showing operating loop: people timeline records showing outcome and assignment", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_showing_timeline");
  seedListing(stack, { id: "subj_showing_a", displayName: "742 Harbor Lane", address: "742 Harbor Lane" });

  const prospect = await seedProspectInquiry({ stack, integrationPlatform, workspaceId });
  await requestShowing({ stack, workspaceId, requestId: prospect.requestId, note: "Tour windows captured" });

  const engagement = new EngagementViewAdapter({ nowISO: NOW }).translate({
    partyId: prospect.partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    platformEventStore: stack.store,
    analyticsRuntime: stack.analyticsRuntime,
  });

  assert.ok(
    engagement.timeline.some((item) => item.type === TIMELINE_ITEM_TYPES.INTERACTION_OUTCOME_RECORDED),
  );
  assert.ok(engagement.timeline.some((item) => item.type === TIMELINE_ITEM_TYPES.WORK_ASSIGNED));
});
