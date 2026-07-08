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
