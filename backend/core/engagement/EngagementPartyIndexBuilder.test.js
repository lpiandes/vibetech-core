import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION } from "../../../industries/property-management/presentation/PropertyManagementDashboardPresentation.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../integration/ProspectInquiryOperatingLoopService.js";
import { buildEngagementPartyIndex } from "./EngagementPartyIndexBuilder.js";

const NOW = "2026-07-06T14:30:00.000Z";

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "People Index Co",
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

test("buildEngagementPartyIndex returns business-scoped hrefs and human labels", async () => {
  const workspaceId = "ws_people_index";
  const businessId = "biz_people_index";
  const { stack, integrationPlatform } = buildStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Casey Prospect",
      email: "casey.prospect@example.com",
      message: "Interested in a 2-bedroom.",
    },
  });

  assert.equal(result.ok, true);

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
    businessId,
    nowISO: NOW,
  });

  assert.equal(index.parties.length, 1);
  const party = index.parties[0];
  assert.equal(party.displayName, "Casey Prospect");
  assert.equal(party.email, "casey.prospect@example.com");
  assert.equal(party.href, `/b/${businessId}/people/${party.partyId}`);
  assert.ok(party.relationshipLabels.includes("Prospect"));
  assert.ok(!party.relationshipTypes.includes("REQUESTED_BY"));
  assert.ok(index.peopleFilters.length > 0);
  assert.ok(index.peopleFilters.some((filter) => filter.id === "active_buyers"));
});

test("tenant B has no people after tenant A prospect inquiry", async () => {
  const a = buildStack("ws_people_tenant_a");
  const b = buildStack("ws_people_tenant_b");
  await connectBusinessEmailDev({ integrationPlatform: a.integrationPlatform, workspaceId: a.stack.workspaceId, nowISO: NOW });

  await runProspectInquiryOperatingLoop({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Tenant A Prospect",
      email: "tenant.a@example.com",
      message: "Hello",
    },
  });

  const indexA = buildEngagementPartyIndex({
    businessGraphRuntime: a.stack.businessGraphRuntime,
    requestRuntime: a.stack.requestRuntime,
    workRuntime: a.stack.workRuntime,
    interactionRuntime: a.stack.interactionRuntime,
    communicationRuntime: a.stack.communicationRuntime,
    businessSubjectRuntime: a.stack.businessSubjectRuntime,
    communicationPreferenceRuntime: a.stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: a.stack.segmentDefinitionRuntime,
    automationRuntime: a.stack.automationRuntime,
    approvalRuntime: a.stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    businessId: "biz_a",
    nowISO: NOW,
  });

  const indexB = buildEngagementPartyIndex({
    businessGraphRuntime: b.stack.businessGraphRuntime,
    requestRuntime: b.stack.requestRuntime,
    workRuntime: b.stack.workRuntime,
    interactionRuntime: b.stack.interactionRuntime,
    communicationRuntime: b.stack.communicationRuntime,
    businessSubjectRuntime: b.stack.businessSubjectRuntime,
    communicationPreferenceRuntime: b.stack.communicationPreferenceRuntime,
    segmentDefinitionRuntime: b.stack.segmentDefinitionRuntime,
    automationRuntime: b.stack.automationRuntime,
    approvalRuntime: b.stack.approvalRuntime,
    presentation: PROPERTY_MANAGEMENT_DASHBOARD_PRESENTATION,
    businessId: "biz_b",
    nowISO: NOW,
  });

  assert.equal(indexA.parties.length, 1);
  assert.equal(indexB.parties.length, 0);
});
