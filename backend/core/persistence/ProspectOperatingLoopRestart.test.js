import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../integration/ProspectInquiryOperatingLoopService.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { buildDigitalEmployeeReadinessReport } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { buildPmProspectCoordinatorPlatformCoverage } from "../platform/knowledge/PlatformKnowledgeReadinessBridge.js";
import { DIGITAL_EMPLOYEE_STATUSES } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { CONNECTION_STATUSES } from "../integrations/connections/ConnectionStatus.js";
import { CommunicationViewAdapter } from "../communications/views/CommunicationViewAdapter.js";
import { buildCommunicationThreadDetail } from "../communications/views/buildCommunicationThreadDetail.js";
import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "./PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "./createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "./RuntimeSnapshotKinds.js";
import { PM_RESIDENT_PROSPECT_COORDINATOR_ID } from "../integration/ProspectInquiryOperatingLoopService.js";
import { AnalyticsIntelligenceEngine } from "../analytics/intelligence/AnalyticsIntelligenceEngine.js";

const NOW = "2026-07-06T14:30:00.000Z";

function sumMetricDataPoints(analyticsRuntime, metricId) {
  return analyticsRuntime
    .getDataPointsByMetric(metricId)
    .reduce((sum, dp) => sum + Number(dp.value ?? 0), 0);
}

function buildActivation(workspaceId, companyName = "Restart Test Co") {
  return {
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    industryPackageVersion: 1,
    packageConfiguration: { companyName },
    demoConfigurationId: null,
    workspaceId,
    activatedAt: NOW,
  };
}

function buildOperatingStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Restart Test Co",
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

function assertProspectLoopState({ stack, integrationPlatform, workspaceId, inquiryMessage }) {
  const emailConn = integrationPlatform.connectionRuntime.getConnectionByType("business_email");
  assert.equal(emailConn?.status, CONNECTION_STATUSES.CONNECTED);

  assert.equal(stack.requestRuntime.getRequests().length, 1);
  assert.equal(stack.requestRuntime.getRequests()[0].requestType, "PROSPECT_INQUIRY");
  assert.equal(stack.requestRuntime.getRequests()[0].description, inquiryMessage);

  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  assert.equal(stack.workRuntime.getWorkItems().length, 1);
  assert.equal(stack.communicationRuntime.getThreads().length, 1);

  const requestId = stack.requestRuntime.getRequests()[0].id;
  const threadId = `ct_ack_${requestId}`;
  const detail = buildCommunicationThreadDetail({
    threadId,
    communicationRuntime: stack.communicationRuntime,
    requestRuntime: stack.requestRuntime,
    businessGraphRuntime: stack.businessGraphRuntime,
    interactionRuntime: stack.interactionRuntime,
  });
  assert.ok(detail);
  assert.equal(detail.inquiry.text, inquiryMessage);
  assert.match(String(detail.thread.subject), /Restart Test Co/);
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0].direction, "outbound");

  const vm = new CommunicationViewAdapter({ nowISO: NOW }).translate({
    communicationRuntime: stack.communicationRuntime,
    workRuntime: stack.workRuntime,
    teamRuntime: stack.teamRuntime,
    companyWorkspaceRuntime: stack.companyRuntime,
  });
  assert.equal(vm.threads.length, 1);

  const connectedSystemsSnapshot = buildConnectedSystemsSnapshot({
    installationResult: stack.installationResult,
    connectionRuntime: integrationPlatform.connectionRuntime,
  });
  const employeeReadinessReport = buildDigitalEmployeeReadinessReport({
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    capabilityRuntime: stack.capabilityRuntime,
    companyRuntime: stack.companyRuntime,
    connectedSystemsSnapshot,
    connectionRuntime: integrationPlatform.connectionRuntime,
    teamRuntime: stack.teamRuntime,
    platformKnowledgeCoverage: buildPmProspectCoordinatorPlatformCoverage(1),
  });
  const coordinator = employeeReadinessReport.employees.find(
    (e) => e.employeeId === PM_RESIDENT_PROSPECT_COORDINATOR_ID,
  );
  assert.equal(coordinator?.status, DIGITAL_EMPLOYEE_STATUSES.READY);
}

test("prospect operating loop survives destroy-and-rehydrate via runtime snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_restart_prospect_a";
  const inquiryMessage = "Looking for a 2-bedroom near downtown.";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);

  assert.equal(stack.communicationRuntime.getThreads().length, 0);

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    persistence,
  });

  const result = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Casey Prospect",
      email: "casey.prospect@example.com",
      message: inquiryMessage,
    },
  });
  assert.equal(result.ok, true);

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  assertProspectLoopState({ stack, integrationPlatform, workspaceId, inquiryMessage });

  const requestCountBefore = sumMetricDataPoints(stack.analyticsRuntime, "request_received_count");
  const workCountBefore = sumMetricDataPoints(stack.analyticsRuntime, "work_created_count");
  assert.ok(requestCountBefore >= 1, "expected request_received_count before restart");
  assert.ok(workCountBefore >= 1, "expected work_created_count before restart");

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.CONNECTION]);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.COMMUNICATION]);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.ANALYTICS]);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  assertProspectLoopState({
    stack: rehydrated.operatingStack,
    integrationPlatform: rehydrated.integrationPlatform,
    workspaceId,
    inquiryMessage,
  });

  const requestCountAfter = sumMetricDataPoints(rehydrated.operatingStack.analyticsRuntime, "request_received_count");
  const workCountAfter = sumMetricDataPoints(rehydrated.operatingStack.analyticsRuntime, "work_created_count");
  assert.equal(requestCountAfter, requestCountBefore);
  assert.equal(workCountAfter, workCountBefore);

  const performanceReport = new AnalyticsIntelligenceEngine({ nowISO: NOW }).generate({
    analyticsRuntime: rehydrated.operatingStack.analyticsRuntime,
  });
  const requestKpi = performanceReport.kpis.find((k) => k.kpiId === "request_volume");
  const workKpi = performanceReport.kpis.find((k) => k.kpiId === "work_created_count");
  assert.ok(requestKpi && Number(requestKpi.value) >= 1);
  assert.ok(workKpi && Number(workKpi.value) >= 1);
});

test("tenant B has no prospect snapshots after tenant A inquiry and rehydrate", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const a = buildOperatingStack("ws_restart_tenant_a");
  const bId = "ws_restart_tenant_b";

  await connectBusinessEmailDev({ integrationPlatform: a.integrationPlatform, workspaceId: a.stack.workspaceId, nowISO: NOW });
  await persistAffectedRuntimes({
    workspaceId: a.stack.workspaceId,
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    persistence,
  });

  await runProspectInquiryOperatingLoop({
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    workspaceId: a.stack.workspaceId,
    nowISO: NOW,
    inquiry: { name: "Only A", email: "only.a@example.com", message: "Tenant A inquiry" },
  });
  await persistAffectedRuntimes({
    workspaceId: a.stack.workspaceId,
    stack: a.stack,
    integrationPlatform: a.integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const bSnapshots = await loadRuntimeSnapshotsMap(bId, persistence);
  const bRehydrated = activateWorkspace({
    workspaceId: bId,
    activation: buildActivation(bId, "Tenant B Co"),
    nowISO: NOW,
    runtimeSnapshots: bSnapshots,
  });

  assert.equal(bRehydrated.operatingStack.communicationRuntime.getThreads().length, 0);
  assert.equal(bRehydrated.operatingStack.requestRuntime.getRequests().length, 0);
  const bEmail = bRehydrated.integrationPlatform.connectionRuntime.getConnectionByType("business_email");
  assert.notEqual(bEmail?.status, CONNECTION_STATUSES.CONNECTED);
});
