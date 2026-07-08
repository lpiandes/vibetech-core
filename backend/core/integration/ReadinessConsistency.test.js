import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "./PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { refreshWorkspaceOperationalState } from "../workspace/refreshWorkspaceOperationalState.js";
import { DIGITAL_EMPLOYEE_STATUSES } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import {
  getDigitalEmployeeReadinessEntry,
  isDigitalEmployeeOperationalReady,
} from "../industries/employees/digitalEmployeeReadinessHelpers.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { ConnectionService } from "../integrations/use-cases/ConnectionService.js";
import { createDefaultIntegrationProviderRegistry } from "../integrations/createIntegrationPlatform.js";

const PM_RESIDENT = "pm_resident_prospect_coordinator";
const NOW = "2026-07-01T00:00:00.000Z";

function buildSharedComposition(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Stale Readiness Co",
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
  return { stack, integrationPlatform, demoConfiguration };
}

function homeEmailComplete(connected, knowledgeCount) {
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  return connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  ) && knowledgeCount > 0;
}

function employeeReady(connected) {
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM_RESIDENT);
  return isDigitalEmployeeOperationalReady(emp);
}

function refresh(connected, platformActiveKnowledgeCount) {
  return refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount,
  });
}

function fixedProspectFormVisible(connected, knowledgeCount) {
  const coordinatorReady = employeeReady(connected);
  const hasInquiry = (connected.ctx.requestRuntime.getRequests?.() ?? []).some(
    (r) => String(r.requestType) === "PROSPECT_INQUIRY",
  );
  return coordinatorReady && !hasInquiry;
}

function legacyProspectFormVisible(connected, knowledgeCount) {
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  const hasInquiry = (connected.ctx.requestRuntime.getRequests?.() ?? []).some(
    (r) => String(r.requestType) === "PROSPECT_INQUIRY",
  );
  return knowledgeCount > 0 && emailConnected && !hasInquiry;
}

test("REGRESSION: connect email before knowledge refresh leaves employee blocked while checklist could disagree", async () => {
  const workspaceId = "ws_stale_sequence";
  const { stack, integrationPlatform } = buildSharedComposition(workspaceId);

  const connected = {
    ctx: stack,
    installationResult: stack.installationResult,
    integrationPlatform,
    activation: { industryPackageId: "pkg_property_management" },
    connectedSystemsSnapshot: null,
    employeeReadinessReport: null,
    platformKnowledgeCoverage: null,
  };

  // Step 1: load workspace while not ready (no knowledge, no email)
  let refreshed = refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: 0,
  });
  Object.assign(connected, refreshed);
  assert.equal(homeEmailComplete(connected, 0), false);
  assert.equal(employeeReady(connected), false);

  // Step 2: connect email only — mimics connectBusinessEmail using stale knowledge count 0
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  refreshed = refreshWorkspaceOperationalState({
    ...connected,
    platformActiveKnowledgeCount: connected.platformKnowledgeCoverage?.activeDocumentCount ?? 0,
  });
  Object.assign(connected, refreshed);
  assert.equal(homeEmailComplete(connected, 0), false); // no knowledge yet
  assert.equal(employeeReady(connected), false);

  // Step 3: knowledge uploaded (postgres count = 1) but NO refresh — stale employee report
  const knowledgeCount = 1;
  const emailOk = homeEmailComplete(connected, knowledgeCount);
  assert.equal(emailOk, true, "checklist would show email+knowledge complete from postgres + snapshot");
  assert.equal(employeeReady(connected), false, "employee readiness still stale without refresh");

  // Step 4: refresh operational state — employee becomes READY without new workspace instance
  refreshed = refreshWorkspaceOperationalState({
    ctx: connected.ctx,
    installationResult: connected.installationResult,
    integrationPlatform: connected.integrationPlatform,
    activation: connected.activation,
    platformActiveKnowledgeCount: knowledgeCount,
  });
  Object.assign(connected, refreshed);
  assert.equal(employeeReady(connected), true);
});

function loadHomeProspectGate(connected, knowledgeCount) {
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  const prerequisitesForProspect = knowledgeCount > 0 && emailConnected;
  const emp = connected.employeeReadinessReport?.employees?.find(
    (e) => e.employeeId === "pm_resident_prospect_coordinator",
  );
  const coordinatorReady =
    emp?.status === DIGITAL_EMPLOYEE_STATUSES.READY || emp?.status === DIGITAL_EMPLOYEE_STATUSES.ACTIVE;
  return { prerequisitesForProspect, coordinatorReady, emp };
}

test("REGRESSION: simplified home gate disagrees with employee readiness without refresh", () => {
  const workspaceId = "ws_gate_mismatch";
  const { stack, integrationPlatform } = buildSharedComposition(workspaceId);
  const connected = {
    ctx: stack,
    installationResult: stack.installationResult,
    integrationPlatform,
    activation: { industryPackageId: "pkg_property_management" },
  };

  connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  Object.assign(
    connected,
    refreshWorkspaceOperationalState({
      ctx: connected.ctx,
      installationResult: connected.installationResult,
      integrationPlatform: connected.integrationPlatform,
      activation: connected.activation,
      platformActiveKnowledgeCount: 0,
    }),
  );

  const gate = loadHomeProspectGate(connected, 1);
  assert.equal(gate.prerequisitesForProspect, true, "legacy home gate would show form");
  assert.equal(gate.coordinatorReady, false, "employee not ready until knowledge refresh");
});

test("REGRESSION: home gate and employee readiness agree after knowledge refresh", async () => {
  const workspaceId = "ws_gate_agreement";
  const { stack, integrationPlatform } = buildSharedComposition(workspaceId);
  const connected = {
    ctx: stack,
    installationResult: stack.installationResult,
    integrationPlatform,
    activation: { industryPackageId: "pkg_property_management" },
  };

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  Object.assign(
    connected,
    refreshWorkspaceOperationalState({
      ctx: connected.ctx,
      installationResult: connected.installationResult,
      integrationPlatform: connected.integrationPlatform,
      activation: connected.activation,
      platformActiveKnowledgeCount: 1,
    }),
  );

  const gate = loadHomeProspectGate(connected, 1);
  assert.equal(gate.prerequisitesForProspect, true);
  assert.equal(gate.coordinatorReady, true);
});

test("employee blocked with no knowledge and no email", () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_none");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  Object.assign(connected, refresh(connected, 0));
  assert.equal(employeeReady(connected), false);
});

test("knowledge only → blocked", () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_k_only");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  Object.assign(connected, refresh(connected, 1));
  assert.equal(employeeReady(connected), false);
});

test("email only → blocked", async () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_e_only");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  Object.assign(connected, refresh(connected, 0));
  assert.equal(employeeReady(connected), false);
});

test("knowledge + connected email → READY", async () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_both");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  Object.assign(connected, refresh(connected, 1));
  const emp = getDigitalEmployeeReadinessEntry(connected.employeeReadinessReport, PM_RESIDENT);
  assert.equal(emp.status, DIGITAL_EMPLOYEE_STATUSES.READY);
});

test("fixed form gate matches employee readiness when stale", async () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_fixed_gate");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  Object.assign(connected, refresh(connected, 0));
  assert.equal(legacyProspectFormVisible(connected, 1), true);
  assert.equal(fixedProspectFormVisible(connected, 1), false);
  Object.assign(connected, refresh(connected, 1));
  assert.equal(fixedProspectFormVisible(connected, 1), true);
});

test("disconnect email makes employee not ready again", async () => {
  const { stack, integrationPlatform } = buildSharedComposition("ws_disconnect");
  const connected = { ctx: stack, installationResult: stack.installationResult, integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  await connectBusinessEmailDev({ integrationPlatform, workspaceId: stack.workspaceId, nowISO: NOW });
  Object.assign(connected, refresh(connected, 1));
  assert.equal(employeeReady(connected), true);

  const emailConn = integrationPlatform.connectionRuntime.getConnectionByType("business_email");
  const connectionService = new ConnectionService({
    connectionRuntime: integrationPlatform.connectionRuntime,
    providerRegistry: createDefaultIntegrationProviderRegistry({ nowISO: NOW }),
    nowISO: NOW,
  });
  connectionService.disconnect({ connectionId: emailConn.id });
  Object.assign(connected, refresh(connected, 1));
  assert.equal(employeeReady(connected), false);
  assert.equal(emailConn && integrationPlatform.connectionRuntime.getConnectionByType("business_email")?.status, CONNECTION_STATUSES.DISCONNECTED);
});

test("tenant A readiness cannot make tenant B ready", async () => {
  const a = buildSharedComposition("ws_tenant_a_ready");
  const b = buildSharedComposition("ws_tenant_b_ready");
  await connectBusinessEmailDev({ integrationPlatform: a.integrationPlatform, workspaceId: a.stack.workspaceId, nowISO: NOW });
  const connectedA = { ctx: a.stack, installationResult: a.stack.installationResult, integrationPlatform: a.integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  Object.assign(connectedA, refresh(connectedA, 1));
  const connectedB = { ctx: b.stack, installationResult: b.stack.installationResult, integrationPlatform: b.integrationPlatform, activation: { industryPackageId: "pkg_property_management" } };
  Object.assign(connectedB, refresh(connectedB, 1));
  assert.equal(employeeReady(connectedA), true);
  assert.equal(employeeReady(connectedB), false);
});

function applyRefreshLikeWorkspaceService(connected, knowledgeCount) {
  const refreshed = refresh(connected, knowledgeCount);
  if (Object.keys(refreshed).length > 0) {
    Object.assign(connected, refreshed);
  }
  return refreshed;
}

function homeProspectGate(connected, knowledgeCount) {
  applyRefreshLikeWorkspaceService(connected, knowledgeCount);
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  const coordinatorReady = employeeReady(connected);
  const showForm =
    coordinatorReady &&
    !(connected.ctx.requestRuntime.getRequests?.() ?? []).some((r) => String(r.requestType) === "PROSPECT_INQUIRY");
  return { knowledgeCount: knowledgeCount > 0, emailConnected, coordinatorReady, showForm };
}

function apiProspectGuard(connected, knowledgeCount) {
  applyRefreshLikeWorkspaceService(connected, knowledgeCount);
  return { allowed: employeeReady(connected) };
}

test("REGRESSION: home prospect gate and API guard agree after email connect sequence", async () => {
  const workspaceId = "ws_home_api_agreement";
  const { stack, integrationPlatform } = buildSharedComposition(workspaceId);
  const connected = {
    ctx: stack,
    installationResult: stack.installationResult,
    integrationPlatform,
    activation: { industryPackageId: "pkg_property_management" },
  };

  applyRefreshLikeWorkspaceService(connected, 0);
  assert.equal(employeeReady(connected), false);

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  applyRefreshLikeWorkspaceService(connected, 1);

  const home = homeProspectGate(connected, 1);
  const api = apiProspectGuard(connected, 1);

  assert.equal(home.knowledgeCount, true);
  assert.equal(home.emailConnected, true);
  assert.equal(home.coordinatorReady, true);
  assert.equal(home.showForm, true);
  assert.equal(api.allowed, true);
  assert.equal(home.coordinatorReady, api.allowed, "home and API must share coordinator readiness");
});

test("REGRESSION: stale employee report blocks API until refresh even when checklist prerequisites look complete", async () => {
  const workspaceId = "ws_stale_then_ready";
  const { stack, integrationPlatform } = buildSharedComposition(workspaceId);
  const connected = {
    ctx: stack,
    installationResult: stack.installationResult,
    integrationPlatform,
    activation: { industryPackageId: "pkg_property_management" },
  };

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  applyRefreshLikeWorkspaceService(connected, 0);
  assert.equal(employeeReady(connected), false);

  const knowledgeCount = 1;
  const connections = connected.connectedSystemsSnapshot?.connections ?? [];
  const emailConnected = connections.some(
    (c) => String(c.id) === "business_email" && String(c.status).toUpperCase() === "CONNECTED",
  );
  assert.equal(knowledgeCount > 0 && emailConnected, true, "checklist prerequisites appear complete");
  assert.equal(fixedProspectFormVisible(connected, knowledgeCount), false, "form hidden until refresh with postgres count");
  assert.equal(employeeReady(connected), false, "API still blocked before refresh with postgres count");

  const home = homeProspectGate(connected, knowledgeCount);
  const api = apiProspectGuard(connected, knowledgeCount);
  assert.equal(home.showForm, true);
  assert.equal(api.allowed, true);
});
