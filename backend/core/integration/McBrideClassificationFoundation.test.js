import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { MCBRIDE_LIFECYCLE_TRANSITIONS } from "../../../industries/property-management/config/mcbrideRelationshipRegistry.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "./ProspectInquiryOperatingLoopService.js";
import { buildEngagementPartyIndex } from "../engagement/EngagementPartyIndexBuilder.js";
import { EngagementViewAdapter } from "../engagement/EngagementViewAdapter.js";
import { filterPartiesByPeopleFilter } from "../industries/people/evaluatePeopleFilter.js";
import {
  ensurePartyRelationship,
  promotePartyRelationship,
  setPartyInactiveStatus,
} from "../business-graph/partyRelationshipClassification.js";
import { REQUEST_EVENT_TYPES } from "../request/RequestEventTypes.js";

const NOW = "2026-07-08T14:00:00.000Z";

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Classification Co",
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
  return { stack, integrationPlatform };
}

function sumMetric(analyticsRuntime, metricId) {
  return analyticsRuntime
    .getDataPointsByMetric(metricId)
    .reduce((sum, point) => sum + Number(point.value ?? 0), 0);
}

test("package installs relationship registry and qualification schema", () => {
  assert.ok(PROPERTY_MANAGEMENT_PACKAGE.relationshipTypes?.some((entry) => entry.type === "BUYER"));
  assert.ok(PROPERTY_MANAGEMENT_PACKAGE.lifecycleTransitions?.some((entry) => entry.from === "BUYER"));
  assert.ok(PROPERTY_MANAGEMENT_PACKAGE.qualificationFieldSchemas?.[0]?.fields?.some((field) => field.key === "intent"));
  assert.ok(PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION.peopleFilters?.some((filter) => filter.id === "active_buyers"));
});

test("prospect inquiry loop still creates PROSPECT and remains unchanged", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_prospect_loop");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const beforeRequests = sumMetric(stack.analyticsRuntime, "request_received_count");
  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Loop Prospect",
      email: "loop.prospect@example.com",
      message: "Still works",
    },
  });

  assert.equal(result.ok, true);
  const rel = stack.businessGraphRuntime.getRelationship(`rel_PROSPECT_${result.partyId}`);
  assert.ok(rel);
  assert.equal(String(rel.status), "active");
  assert.equal(sumMetric(stack.analyticsRuntime, "request_received_count"), beforeRequests + 1);
});

test("additive BUYER keeps PROSPECT active and active buyers filter matches", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_additive_buyer");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Buyer Prospect",
      email: "buyer.prospect@example.com",
      message: "Looking to buy",
    },
  });
  assert.equal(inquiry.ok, true);

  ensurePartyRelationship({
    stack,
    partyId: inquiry.partyId,
    relationshipType: "BUYER",
    nowISO: NOW,
  });

  const prospect = stack.businessGraphRuntime.getRelationship(`rel_PROSPECT_${inquiry.partyId}`);
  const buyer = stack.businessGraphRuntime.getRelationship(`rel_BUYER_${inquiry.partyId}`);
  assert.equal(String(prospect.status), "active");
  assert.equal(String(buyer.status), "active");

  const index = buildEngagementPartyIndex({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    businessId: "biz_class",
    nowISO: NOW,
  });

  assert.ok(index.peopleFilters.length > 0);
  const activeBuyers = filterPartiesByPeopleFilter({
    parties: index.parties,
    filterId: "active_buyers",
    peopleFilters: index.peopleFilters,
  });
  const prospects = filterPartiesByPeopleFilter({
    parties: index.parties,
    filterId: "prospects",
    peopleFilters: index.peopleFilters,
  });
  assert.equal(activeBuyers.length, 1);
  assert.equal(prospects.length, 1);
});

test("classification alone does not change prospect request metrics", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_kpi_guard");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "KPI Guard",
      email: "kpi.guard@example.com",
      message: "Hello",
    },
  });
  const afterInquiry = sumMetric(stack.analyticsRuntime, "request_received_count");

  ensurePartyRelationship({ stack, partyId: inquiry.partyId, relationshipType: "BUYER", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId: inquiry.partyId, relationshipType: "INVESTOR", nowISO: NOW });

  assert.equal(sumMetric(stack.analyticsRuntime, "request_received_count"), afterInquiry);
});

test("people detail hides qualification without persisted values and shows real values when present", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_qual_detail");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Qual Person",
      email: "qual.person@example.com",
      message: "Need details",
    },
  });

  const adapter = new EngagementViewAdapter({ nowISO: NOW });
  const withoutQual = adapter.translate({
    partyId: inquiry.partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });
  assert.equal(
    withoutQual.qualificationSummary.filter((entry) => entry.qualification && Object.keys(entry.qualification).length > 0)
      .length,
    0,
  );

  const request = stack.requestRuntime.getRequest(inquiry.requestId);
  stack.requestRuntime.applyEvent({
    id: "evt_req_qual_patch",
    timestampISO: NOW,
    type: REQUEST_EVENT_TYPES.REQUEST_UPDATED,
    source: "test",
    payload: {
      requestId: request.id,
      patch: {
        metadata: {
          ...(request.metadata ?? {}),
          qualification: {
            intent: "buy",
            priceRange: "$400k-$500k",
          },
        },
      },
    },
  });

  const withQual = adapter.translate({
    partyId: inquiry.partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  const populated = withQual.qualificationSummary.filter(
    (entry) => entry.qualification && Object.keys(entry.qualification).length > 0,
  );
  assert.equal(populated.length, 1);
  assert.equal(populated[0].qualification.intent, "buy");
});

test("promotion preserves ended BUYER in relationship summary", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_promote_summary");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Promote Person",
      email: "promote.person@example.com",
      message: "Buy then close",
    },
  });

  ensurePartyRelationship({ stack, partyId: inquiry.partyId, relationshipType: "BUYER", nowISO: NOW });
  promotePartyRelationship({
    stack,
    partyId: inquiry.partyId,
    fromRelationshipType: "BUYER",
    toRelationshipType: "PAST_BUYER",
    nowISO: NOW,
    lifecycleTransitions: MCBRIDE_LIFECYCLE_TRANSITIONS,
  });

  const adapter = new EngagementViewAdapter({ nowISO: NOW });
  const vm = adapter.translate({
    partyId: inquiry.partyId,
    businessGraphRuntime: stack.businessGraphRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    communicationRuntime: stack.communicationRuntime,
    interactionRuntime: stack.interactionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
  });

  const labels = vm.relationshipSummary.map((rel) => String(rel.relationshipLabel));
  const statuses = vm.relationshipSummary.map((rel) => String(rel.status));
  assert.ok(labels.includes("Buyer"));
  assert.ok(labels.includes("Past Buyer"));
  assert.ok(statuses.includes("ended"));
  assert.ok(statuses.includes("active"));
});

test("inactive filter uses party status", async () => {
  const { stack, integrationPlatform } = buildStack("ws_class_inactive");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Inactive Person",
      email: "inactive.person@example.com",
      message: "Hello",
    },
  });

  setPartyInactiveStatus({ stack, partyId: inquiry.partyId, nowISO: NOW, status: "inactive" });

  const index = buildEngagementPartyIndex({
    businessGraphRuntime: stack.businessGraphRuntime,
    requestRuntime: stack.requestRuntime,
    workRuntime: stack.workRuntime,
    interactionRuntime: stack.interactionRuntime,
    communicationRuntime: stack.communicationRuntime,
    businessSubjectRuntime: stack.businessSubjectRuntime,
    communicationPreferenceRuntime: stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: stack.segmentDefinitionRuntime,
    automationRuntime: stack.automationRuntime,
    approvalRuntime: stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    businessId: "biz_inactive",
    nowISO: NOW,
  });

  const inactive = filterPartiesByPeopleFilter({
    parties: index.parties,
    filterId: "inactive",
    peopleFilters: index.peopleFilters,
  });
  assert.equal(inactive.length, 1);
  assert.equal(inactive[0].partyStatus, "inactive");
});
