import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../integration/ProspectInquiryOperatingLoopService.js";
import {
  runShowingCoordinationOperatingLoop,
  showingInteractionIdForRequest,
} from "../integration/ShowingCoordinationOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { AnalyticsIntelligenceEngine } from "../analytics/intelligence/AnalyticsIntelligenceEngine.js";
import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "./PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "./createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "./RuntimeSnapshotKinds.js";

const NOW = "2026-07-08T16:00:00.000Z";

function buildActivation(workspaceId, companyName = "Showing Restart Co") {
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
    companyName: "Showing Restart Co",
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

function seedListing(stack, { id, displayName }) {
  new RecordBusinessSubjectService().execute({
    businessSubjectRuntime: stack.businessSubjectRuntime,
    workspaceId: stack.workspaceId,
    subjectInput: { id, subjectType: "listing", displayName, keyAttributes: { address: displayName } },
    nowISO: NOW,
    source: "test",
  });
}

function sumMetric(analyticsRuntime, metricId) {
  return analyticsRuntime
    .getDataPointsByMetric(metricId)
    .reduce((sum, dp) => sum + Number(dp.value ?? 0), 0);
}

function assertShowingLoopState({ stack, requestId }) {
  const interactionId = showingInteractionIdForRequest(requestId);
  const interaction = stack.interactionRuntime.getInteraction(interactionId);
  assert.ok(interaction);
  assert.equal(interaction.outcome, "showing_requested");

  const work = stack.workRuntime.getWorkItem(`work_pm_showing_${interactionId}`);
  assert.ok(work);
  assert.equal(String(work.workType), "showing_coordination");
}

test("showing operating loop survives destroy-and-rehydrate via runtime snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_restart_showing";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  seedListing(stack, { id: "subj_restart", displayName: "88 Restart Lane" });

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    persistence,
  });

  const prospect = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: {
      name: "Casey Prospect",
      email: "casey.restart@example.com",
      message: "Interested in 88 Restart Lane",
      subjectId: "subj_restart",
    },
  });
  assert.equal(prospect.ok, true);

  const showing = await runShowingCoordinationOperatingLoop({
    stack,
    workspaceId,
    nowISO: NOW,
    request: { requestId: prospect.requestId, note: "Ready for showing coordination" },
  });
  assert.equal(showing.ok, true);

  const workCreatedBefore = sumMetric(stack.analyticsRuntime, "work_created_count");
  const workAssignedBefore = sumMetric(stack.analyticsRuntime, "work_assigned_count");
  assert.ok(workCreatedBefore >= 1);
  assert.ok(workAssignedBefore >= 1);

  assertShowingLoopState({ stack, requestId: prospect.requestId });

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [...PROSPECT_LOOP_SNAPSHOT_KINDS],
    persistence,
  });

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.WORK]);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.INTERACTION]);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.ANALYTICS]);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  assertShowingLoopState({ stack: rehydrated.operatingStack, requestId: prospect.requestId });

  assert.equal(
    sumMetric(rehydrated.operatingStack.analyticsRuntime, "work_created_count"),
    workCreatedBefore,
  );
  assert.equal(
    sumMetric(rehydrated.operatingStack.analyticsRuntime, "work_assigned_count"),
    workAssignedBefore,
  );

  const performanceReport = new AnalyticsIntelligenceEngine({ nowISO: NOW }).generate({
    analyticsRuntime: rehydrated.operatingStack.analyticsRuntime,
  });
  const workCreatedKpi = performanceReport.kpis.find((k) => k.kpiId === "work_created_count");
  assert.ok(workCreatedKpi && Number(workCreatedKpi.value) >= 1);
});
