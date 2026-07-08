import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "./ProspectInquiryOperatingLoopService.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildPmProspectCoordinatorPlatformCoverage } from "../platform/knowledge/PlatformKnowledgeReadinessBridge.js";
import { DIGITAL_EMPLOYEE_STATUSES } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { BUSINESS_SUBJECT_EVENT_TYPES } from "../business-subject/BusinessSubjectEventTypes.js";

const NOW = "2026-07-01T00:00:00.000Z";

function buildNormalBusinessStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Normal PM Co",
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

function seedSubject(stack, { subjectId = "subj_main", displayName = "123 Main St", address = "123 main st" } = {}) {
  stack.businessSubjectRuntime.applyEvent({
    id: `evt_subject_${subjectId}`,
    timestampISO: NOW,
    type: BUSINESS_SUBJECT_EVENT_TYPES.SUBJECT_CREATED,
    source: "prospect_flow_test",
    payload: {
      subject: {
        id: subjectId,
        workspaceId: stack.workspaceId,
        subjectType: "listing",
        displayName,
        status: "active",
        keyAttributes: { address },
        externalReferences: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
  });
}

function residentCoordinatorReadiness({ stack, integrationPlatform, platformDocumentCount }) {
  const connectedSystemsSnapshot = buildConnectedSystemsSnapshot({
    installationResult: stack.installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
  });
  return buildDigitalEmployeeReadinessReport({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    capabilityRuntime: stack.capabilityRuntime,
    companyRuntime: stack.companyRuntime,
    connectedSystemsSnapshot,
    connectionRuntime: integrationPlatform.connectionRuntime,
    teamRuntime: stack.teamRuntime,
    platformKnowledgeCoverage: buildPmProspectCoordinatorPlatformCoverage(platformDocumentCount),
  }).employees.find((e) => e.employeeId === "pm_resident_prospect_coordinator");
}

test("readiness blocked without platform knowledge", () => {
  const { stack, integrationPlatform } = buildNormalBusinessStack("ws_pm_readiness_blocked");
  const employee = residentCoordinatorReadiness({ stack, integrationPlatform, platformDocumentCount: 0 });
  assert.ok(employee);
  assert.notEqual(employee.status, DIGITAL_EMPLOYEE_STATUSES.READY);
  assert.ok(employee.missingKnowledge.length > 0);
});

test("readiness unblocked with platform knowledge and connected email", async () => {
  const { stack, integrationPlatform } = buildNormalBusinessStack("ws_pm_readiness_ready");
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  const employee = residentCoordinatorReadiness({ stack, integrationPlatform, platformDocumentCount: 1 });
  assert.equal(employee.status, DIGITAL_EMPLOYEE_STATUSES.READY);
});

test("connected business email enables SEND_EMAIL capability", async () => {
  const { stack, integrationPlatform } = buildNormalBusinessStack("ws_pm_email_connect");
  const conn = await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  assert.equal(conn.status, CONNECTION_STATUSES.CONNECTED);
});

test("prospect inquiry creates work and sends email on normal business", async () => {
  const workspaceId = "ws_pm_prospect_loop";
  const { stack, integrationPlatform } = buildNormalBusinessStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Casey Prospect",
      email: "casey.prospect@example.com",
      message: "Looking for a 2-bedroom near downtown.",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.emailResult.status, "sent");
  assert.ok(result.prospectFollowUpWork, "prospect follow-up work should be created");
  assert.equal(String(result.prospectFollowUpWork.workType), "prospect_follow_up");

  const request = stack.requestRuntime.getRequest(result.requestId);
  assert.equal(request.requestType, "PROSPECT_INQUIRY");
  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  assert.ok(stack.communicationRuntime.getMessage(`cm_ack_${result.requestId}`));
});

test("prospect acknowledgment subject uses configured company name", async () => {
  const workspaceId = "ws_pm_company_name";
  const { stack, integrationPlatform } = buildNormalBusinessStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId: stack.workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Pat Prospect",
      email: "pat@example.com",
      message: "Availability question.",
    },
  });

  assert.equal(result.ok, true);
  const thread = stack.communicationRuntime.getThread(`ct_ack_${result.requestId}`);
  assert.match(String(thread?.subject), /Re: Your inquiry to Normal PM Co/);
});

test("prospect inquiry exact property text links existing subject without creating subjects from vague text", async () => {
  const workspaceId = "ws_pm_prospect_property_text";
  const { stack, integrationPlatform } = buildNormalBusinessStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  seedSubject(stack, { subjectId: "subj_123_main", displayName: "123 main st", address: "123 main st" });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Alex Morgan",
      email: "alex@morhan.com",
      message: "i want 123 main st",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.inferredSubjectInterest.subjectId, "subj_123_main");

  const request = stack.requestRuntime.getRequest(result.requestId);
  assert.equal(request.subjectRefs[0].entityId, "subj_123_main");
  const interaction = stack.interactionRuntime.getInteraction(result.interactionId);
  assert.ok(interaction.relatedObjects.some((ref) => ref.entityType === "Subject" && ref.entityId === "subj_123_main"));
  assert.ok(
    stack.businessGraphRuntime.getRelationships().some(
      (rel) =>
        rel.relationshipType === "INTERESTED_IN" &&
        rel.fromEntity.entityId === result.partyId &&
        rel.toEntity.entityId === "subj_123_main",
    ),
  );

  const beforeSubjects = stack.businessSubjectRuntime.getSubjects().length;
  const vague = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Vague Prospect",
      email: "vague@example.com",
      message: "looking near downtown",
    },
  });
  assert.equal(vague.ok, true);
  assert.equal(vague.inferredSubjectInterest, null);
  assert.equal(stack.requestRuntime.getRequest(vague.requestId).subjectRefs.length, 0);
  assert.equal(stack.businessSubjectRuntime.getSubjects().length, beforeSubjects);
});

test("normal business starts with empty communication runtime", () => {
  const { stack } = buildNormalBusinessStack("ws_pm_empty_comms");
  assert.equal(stack.communicationRuntime.getThreads().length, 0);
});

test("email not sent when business email disconnected", async () => {
  const workspaceId = "ws_pm_no_email";
  const { stack, integrationPlatform } = buildNormalBusinessStack(workspaceId);

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Dana Prospect",
      email: "dana.prospect@example.com",
      message: "Interested in leasing.",
    },
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.emailResult.status, "sent");
  assert.ok(result.prospectFollowUpWork);
});

test("tenant isolation: prospect data does not appear in other workspace", async () => {
  const a = buildNormalBusinessStack("ws_pm_tenant_a");
  const b = buildNormalBusinessStack("ws_pm_tenant_b");
  await connectBusinessEmailDev({ integrationPlatform: a.integrationPlatform, workspaceId: a.stack.workspaceId, nowISO: NOW });

  await runProspectInquiryOperatingLoop({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.stack.workspaceId,
    nowISO: NOW,
    inquiry: { name: "Only A", email: "only.a@example.com", message: "Tenant A inquiry" },
  });

  assert.equal(b.stack.requestRuntime.getRequests().length, 0);
  assert.equal(b.stack.businessGraphRuntime.getParties().length, 0);
  assert.equal(b.stack.communicationRuntime.getThreads().length, 0);
  assert.equal(a.stack.requestRuntime.getRequests().length, 1);
});

test("normal business stack has no horizon demo parties", () => {
  const { stack } = buildNormalBusinessStack("ws_pm_no_demo");
  assert.equal(stack.businessGraphRuntime.getParties().length, 0);
  assert.equal(stack.requestRuntime.getRequests().length, 0);
  assert.equal(stack.communicationRuntime.getThreads().length, 0);
});
