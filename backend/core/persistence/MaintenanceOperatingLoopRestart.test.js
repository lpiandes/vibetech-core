import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import {
  runMaintenanceRequestOperatingLoop,
  PM_MAINTENANCE_COORDINATOR_ID,
} from "../integration/MaintenanceRequestOperatingLoopService.js";
import { RecordBusinessSubjectService } from "../business-subject/RecordBusinessSubjectService.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "./PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "./createWorkspacePersistence.js";
import {
  RUNTIME_SNAPSHOT_KINDS,
  PROSPECT_LOOP_SNAPSHOT_KINDS,
} from "./RuntimeSnapshotKinds.js";
import { ENTITY_TYPES } from "../references/EntityRef.js";

const NOW = "2026-07-08T14:00:00.000Z";

function buildActivation(workspaceId, companyName = "Maintenance Restart Co") {
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
    companyName: "Maintenance Restart Co",
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

function assertMaintenanceLoopState({ stack, description }) {
  assert.equal(stack.requestRuntime.getRequests().length, 1);
  const request = stack.requestRuntime.getRequests()[0];
  assert.equal(String(request.requestType), "MAINTENANCE_REQUEST");
  assert.equal(request.description, description);
  assert.equal(request.subjectRefs[0].entityId, "subj_restart");

  assert.equal(stack.businessGraphRuntime.getParties().length, 1);
  const partyId = request.requester;
  const relationships = stack.businessGraphRuntime.getRelationships();
  assert.ok(relationships.some((r) => String(r.relationshipType) === "RESIDENT"));
  assert.ok(
    relationships.some(
      (r) =>
        String(r.relationshipType) === "RESIDENT_OF" &&
        String(r.toEntity?.entityId) === "subj_restart",
    ),
  );

  const workItems = stack.workRuntime.getWorkItems().filter(
    (w) => String(w.workType) === "maintenance_coordination",
  );
  assert.equal(workItems.length, 1);
  assert.equal(String(workItems[0].assignedTo), PM_MAINTENANCE_COORDINATOR_ID);

  assert.equal(stack.interactionRuntime.getInteractions().length, 1);
  assert.equal(stack.communicationRuntime.getThreads().length, 1);
}

test("maintenance operating loop survives destroy-and-rehydrate via runtime snapshots", async () => {
  const persistence = new InMemoryWorkspacePersistence();
  const workspaceId = "ws_restart_maint_a";
  const description = "Heater is not working in the bedroom.";
  const { stack, integrationPlatform } = buildOperatingStack(workspaceId);
  seedListing(stack, { id: "subj_restart", displayName: "88 Maple St" });

  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });
  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform,
    kinds: [RUNTIME_SNAPSHOT_KINDS.CONNECTION],
    persistence,
  });

  const result = await runMaintenanceRequestOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    request: {
      name: "Alex Resident",
      email: "alex.resident@example.com",
      description,
      subjectId: "subj_restart",
      permissionToContact: true,
      urgency: "high",
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

  assertMaintenanceLoopState({ stack, description });

  const runtimeSnapshots = await loadRuntimeSnapshotsMap(workspaceId, persistence);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.REQUEST]);
  assert.ok(runtimeSnapshots[RUNTIME_SNAPSHOT_KINDS.WORK]);

  const rehydrated = activateWorkspace({
    workspaceId,
    activation: buildActivation(workspaceId),
    nowISO: NOW,
    runtimeSnapshots,
  });

  assertMaintenanceLoopState({
    stack: rehydrated.operatingStack,
    description,
  });
});
