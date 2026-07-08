import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import {
  runMaintenanceRequestOperatingLoop,
  PM_MAINTENANCE_COORDINATOR_ID,
} from "./MaintenanceRequestOperatingLoopService.js";
import { runProspectInquiryOperatingLoop } from "./ProspectInquiryOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { updateBusinessSubjectStatus } from "../business-subject/updateBusinessSubjectStatus.js";
import { buildSubjectPortfolioProjection } from "../business-subject/views/buildSubjectPortfolioProjection.js";
import { buildSubjectAudiencePreview } from "../segments/views/buildSubjectAudiencePreview.js";
import { presentDigitalWorkforce } from "../command-center/DigitalWorkforcePresentation.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildPmProspectCoordinatorPlatformCoverage } from "../platform/knowledge/PlatformKnowledgeReadinessBridge.js";
import { DIGITAL_EMPLOYEE_STATUSES } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";
import { buildEngagementPartyIndex } from "../engagement/EngagementPartyIndexBuilder.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { buildSubjectOperatingDetail } from "../business-subject/views/buildSubjectOperatingDetail.js";
import { WorkViewAdapter } from "../work/views/WorkViewAdapter.js";

const NOW = "2026-07-08T12:00:00.000Z";
const SUBJECT_TYPES = ["property", "listing", "unit"];

function buildOperatingStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Maintenance Loop Co",
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

function maintenancePayload(overrides = {}) {
  return {
    name: "Jordan Kim",
    email: "jordan.kim@example.com",
    description: "Water is leaking from under the kitchen sink",
    subjectId: "subj_maint_a",
    permissionToContact: true,
    urgency: "high",
    ...overrides,
  };
}

async function submitMaintenance({ stack, integrationPlatform, workspaceId, request, connectEmail = false }) {
  if (connectEmail) {
    await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  }
  return runMaintenanceRequestOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    request,
  });
}

function findRelationship(graph, { partyId, relationshipType, subjectId = null }) {
  return graph.getRelationships().find((rel) => {
    if (String(rel.relationshipType) !== relationshipType) return false;
    const fromParty = String(rel.fromEntity?.entityId) === partyId;
    if (!fromParty) return false;
    if (!subjectId) {
      return String(rel.toEntity?.entityType) === ENTITY_TYPES.ORGANIZATION;
    }
    return (
      String(rel.toEntity?.entityType) === ENTITY_TYPES.SUBJECT &&
      String(rel.toEntity?.entityId) === subjectId
    );
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

function subjectRow(stack, subjectId) {
  return buildSubjectPortfolioProjection({
    ctx: buildCtx(stack),
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  }).subjects.find((row) => row.subjectId === subjectId);
}

test("maintenance operating loop: new resident, relationships, work, and metric isolation", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_full");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  const baseline = portfolioTotals(stack);
  assert.equal(baseline.totalInquiries, 0);

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
    connectEmail: true,
  });
  assert.equal(result.ok, true);

  const partyId = result.partyId;
  assert.ok(stack.businessGraphRuntime.getParty(partyId));
  assert.equal(stack.businessGraphRuntime.getParty(partyId).displayName, "Jordan Kim");
  assert.equal(stack.businessGraphRuntime.getParties().length, 1);

  assert.ok(findRelationship(stack.businessGraphRuntime, { partyId, relationshipType: "RESIDENT" }));
  assert.ok(
    findRelationship(stack.businessGraphRuntime, {
      partyId,
      relationshipType: "RESIDENT_OF",
      subjectId: "subj_maint_a",
    }),
  );

  const request = stack.requestRuntime.getRequest(result.requestId);
  assert.equal(String(request.requestType), "MAINTENANCE_REQUEST");
  assert.equal(request.subjectRefs[0].entityId, "subj_maint_a");
  assert.equal(request.description, "Water is leaking from under the kitchen sink");

  const work = result.maintenanceCoordinationWork;
  assert.ok(work);
  assert.equal(String(work.workType), "maintenance_coordination");
  assert.equal(String(work.assignedTo), PM_MAINTENANCE_COORDINATOR_ID);

  const after = portfolioTotals(stack);
  assert.equal(after.totalInquiries, baseline.totalInquiries);
  assert.equal(after.openInquiries, baseline.openInquiries);
  assert.equal(after.interestedProspects, baseline.interestedProspects);

  const row = subjectRow(stack, "subj_maint_a");
  assert.equal(row.inquiryCount, 0);
  assert.equal(row.interestedCount, 0);

  const audience = buildSubjectAudiencePreview({
    subjectId: "subj_maint_a",
    businessSubjectRuntime: stack.businessSubjectRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    interactionRuntime: stack.interactionRuntime,
    presentation: { interactionOutcomes: stack.installationResult.interactionOutcomes },
    nowISO: NOW,
  });
  assert.equal(audience.audience.totalCount, 0);
});

test("maintenance operating loop: reuses existing resident party", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_reuse");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  const first = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
  });
  const second = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ description: "Bathroom faucet dripping" }),
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.partyId, second.partyId);
  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  assert.equal(stack.requestRuntime.getRequests().length, 2);
  assert.equal(stack.interactionRuntime.getInteractions().length, 2);
  assert.equal(
    stack.workRuntime.getWorkItems().filter((w) => String(w.workType) === "maintenance_coordination").length,
    2,
  );
});

test("maintenance operating loop: rejects inactive property without side effects", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_inactive");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });
  updateBusinessSubjectStatus({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    subjectId: "subj_maint_a",
    status: "inactive",
    nowISO: NOW,
    source: "test",
  });

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "property_inactive");
  assert.equal(stack.requestRuntime.getRequests().length, 0);
  assert.equal(stack.workRuntime.getWorkItems().length, 0);
});

test("maintenance operating loop: succeeds without email connection", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_no_email");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
    connectEmail: false,
  });
  assert.equal(result.ok, true);
  assert.ok(["blocked", "skipped"].includes(String(result.emailResult?.status)));
  assert.equal(stack.requestRuntime.getRequests().length, 1);
  assert.equal(stack.workRuntime.getWorkItems().length, 1);
  assert.equal(stack.communicationRuntime.getThreads().length, 0);
});

test("maintenance operating loop: email connected records truthful acknowledgment", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_email");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
    connectEmail: true,
  });
  assert.equal(result.ok, true);
  assert.ok(["sent", "recorded"].includes(String(result.emailResult?.status)));
  assert.equal(stack.communicationRuntime.getThreads().length, 1);
});

test("maintenance operating loop: permission to contact false blocks acknowledgment", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_no_contact");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ permissionToContact: false }),
    connectEmail: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.emailResult?.status, "skipped");
  assert.equal(stack.communicationRuntime.getThreads().length, 0);
  const prefs = stack.communicationPreferenceRuntime.getPreferencesForParty(result.partyId);
  assert.ok(prefs.some((p) => p.channel === "email" && p.status === "opt_out"));
});

test("maintenance operating loop: prospect metrics unchanged after prospect then maintenance", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_prospect_iso");
  seedListing(stack, { id: "subj_list_a", displayName: "456 Pine", address: "456 Pine" });
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Taylor Prospect",
      email: "taylor@example.com",
      message: "Interested in 456 Pine",
      subjectId: "subj_list_a",
    },
  });

  const afterProspect = portfolioTotals(stack);
  assert.equal(afterProspect.totalInquiries, 1);
  assert.ok(afterProspect.interestedProspects >= 1);

  await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ email: "jordan.kim@example.com" }),
  });

  const afterMaintenance = portfolioTotals(stack);
  assert.equal(afterMaintenance.totalInquiries, afterProspect.totalInquiries);
  assert.equal(afterMaintenance.openInquiries, afterProspect.openInquiries);
  assert.equal(afterMaintenance.interestedProspects, afterProspect.interestedProspects);
});

test("maintenance coordinator readiness remains degraded without SMS and PMS", async () => {
  const { stack, integrationPlatform } = buildOperatingStack("ws_maint_readiness");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const connectedSystemsSnapshot = buildConnectedSystemsSnapshot({
    installationResult: stack.installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
  });
  const report = buildDigitalEmployeeReadinessReport({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    capabilityRuntime: stack.capabilityRuntime,
    companyRuntime: stack.companyRuntime,
    connectedSystemsSnapshot,
    connectionRuntime: integrationPlatform.connectionRuntime,
    teamRuntime: stack.teamRuntime,
    platformKnowledgeCoverage: buildPmProspectCoordinatorPlatformCoverage(2),
  });
  const maintenance = report.employees.find((e) => e.employeeId === PM_MAINTENANCE_COORDINATOR_ID);
  assert.ok(maintenance);
  assert.notEqual(maintenance.status, DIGITAL_EMPLOYEE_STATUSES.READY);
  assert.ok(maintenance.blockers.some((b) => b.type === "connection" || b.type === "knowledge"));
});

test("maintenance team monitoring reflects real assignment evidence", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_team");
  seedListing(stack, { id: "subj_maint_a", displayName: "123 Oak Ave", address: "123 Oak Ave" });

  await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload(),
  });

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

  const maint = workforce.digitalEmployees.find((e) => e.id === PM_MAINTENANCE_COORDINATOR_ID);
  assert.ok(maint);
  assert.ok(maint.monitoring.some((m) => m.count >= 1));
});

test("maintenance tenant isolation: business B does not see business A state", async () => {
  const a = buildOperatingStack("ws_maint_tenant_a");
  const b = buildOperatingStack("ws_maint_tenant_b");
  seedListing(a.stack, { id: "subj_maint_a", displayName: "A Property", address: "A" });

  const result = await submitMaintenance({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.workspaceId,
    request: maintenancePayload(),
  });
  assert.equal(result.ok, true);

  assert.equal(b.stack.requestRuntime.getRequests().length, 0);
  assert.equal(b.stack.workRuntime.getWorkItems().length, 0);
  assert.equal(b.stack.businessGraphRuntime.getParties().length, 0);
});

test("maintenance rejects foreign subject id", async () => {
  const a = buildOperatingStack("ws_maint_foreign_a");
  const b = buildOperatingStack("ws_maint_foreign_b");
  seedListing(b.stack, { id: "subj_foreign", displayName: "Foreign", address: "Foreign" });

  const result = await submitMaintenance({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.workspaceId,
    request: maintenancePayload({ subjectId: "subj_foreign" }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "subject_not_found");
  assert.equal(a.stack.requestRuntime.getRequests().length, 0);
});

test("maintenance resident name is indexed on People and property name stays on subject chip", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_people");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({
      name: "Jane Resident",
      email: "jane.resident@example.com",
      subjectId: "subj_main",
    }),
  });
  assert.equal(result.ok, true);

  const party = stack.businessGraphRuntime.getParty(result.partyId);
  assert.equal(party.displayName, "Jane Resident");

  const index = buildEngagementPartyIndex({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    businessId: workspaceId,
    nowISO: NOW,
  });
  const row = index.parties.find((p) => p.partyId === result.partyId);
  assert.ok(row);
  assert.equal(row.displayName, "Jane Resident");
  assert.equal(row.primarySubjectName, "123 main st");
});

test("maintenance property detail uses Recent requests section label from PM presentation", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_detail_label");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ subjectId: "subj_main" }),
  });

  const detail = buildSubjectOperatingDetail({
    subjectId: "subj_main",
    ctx: buildCtx(stack),
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  assert.equal(detail.sectionLabels.recentInquiries, "Recent requests");
  assert.equal(detail.recentInquiries.length, 1);
});

test("maintenance work rows use business-scoped links and never /engagement/tm_system", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_work_href");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({
      name: "Jane Resident",
      email: "jane.resident@example.com",
      subjectId: "subj_main",
    }),
  });
  assert.equal(result.ok, true);

  const vm = new WorkViewAdapter({ nowISO: NOW }).translate({
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    companyRuntime: stack.companyRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    requestRuntime: stack.requestRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    businessId: workspaceId,
  });

  const item = vm.items.find((w) => w.id === result.maintenanceCoordinationWork.id);
  assert.ok(item);
  const display = item.metadata.display;
  assert.equal(display.engagementHref, null);
  assert.equal(display.personHref, `/b/${workspaceId}/people/${result.partyId}`);
  assert.equal(display.rowHref, `/b/${workspaceId}/people/${result.partyId}`);
});

test("maintenance home digital workforce labels stay truthful with readiness blockers", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_home_labels");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ subjectId: "subj_main" }),
  });

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
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    nowISO: NOW,
  });

  const maint = workforce.digitalEmployees.find((e) => e.id === PM_MAINTENANCE_COORDINATOR_ID);
  const owner = workforce.digitalEmployees.find((e) => e.id === "pm_owner_success_coordinator");
  assert.ok(maint);
  assert.ok(owner);
  assert.notEqual(maint.operatingLabel, "READY");
  assert.notEqual(owner.operatingLabel, "READY");
});

test("maintenance property detail shows two distinct recent requests and open work items", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_detail_dual");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  const first = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({
      subjectId: "subj_main",
      description: "Fuse box issue",
    }),
  });
  const second = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({
      subjectId: "subj_main",
      description: "Kitchen sink leak",
    }),
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const detail = buildSubjectOperatingDetail({
    subjectId: "subj_main",
    ctx: buildCtx(stack),
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    subjectTypes: SUBJECT_TYPES,
    nowISO: NOW,
  });

  assert.equal(detail.recentInquiries.length, 2);
  assert.equal(new Set(detail.recentInquiries.map((r) => r.id)).size, 2);
  assert.equal(detail.openWork.length, 2);
  assert.equal(new Set(detail.openWork.map((w) => w.id)).size, 2);
});

test("maintenance operating loop increments request volume analytics for inbound requests", async () => {
  const { stack, integrationPlatform, workspaceId } = buildOperatingStack("ws_maint_analytics");
  seedListing(stack, { id: "subj_main", displayName: "123 main st", address: "123 main st" });

  const before = stack.analyticsRuntime
    .getDataPointsByMetric("request_received_count")
    .reduce((sum, dp) => sum + Number(dp.value ?? 0), 0);

  const result = await submitMaintenance({
    stack,
    integrationPlatform,
    workspaceId,
    request: maintenancePayload({ subjectId: "subj_main" }),
    connectEmail: true,
  });
  assert.equal(result.ok, true);

  const after = stack.analyticsRuntime
    .getDataPointsByMetric("request_received_count")
    .reduce((sum, dp) => sum + Number(dp.value ?? 0), 0);
  assert.equal(after, before + 1);
});
