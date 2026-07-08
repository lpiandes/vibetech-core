import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { BUSINESS_GRAPH_EVENT_TYPES } from "../business-graph/BusinessGraphEventTypes.js";
import { createBusinessParty } from "../business-graph/BusinessParty.js";
import { ensurePartyRelationship } from "../business-graph/partyRelationshipClassification.js";
import { InMemoryWorkspacePersistence } from "./InMemoryWorkspacePersistence.js";
import { persistAffectedRuntimes } from "./PersistedMutationCoordinator.js";
import { loadRuntimeSnapshotsMap } from "./createWorkspacePersistence.js";
import { RUNTIME_SNAPSHOT_KINDS } from "./RuntimeSnapshotKinds.js";

const NOW = "2026-07-08T15:00:00.000Z";

function buildActivation(workspaceId) {
  return {
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    industryPackageVersion: 1,
    packageConfiguration: { companyName: "Classification Restart Co" },
    demoConfigurationId: null,
    workspaceId,
    activatedAt: NOW,
  };
}

function seedParty(stack, partyId) {
  stack.businessGraphRuntime.applyEvent({
    id: `evt_party_${partyId}`,
    timestampISO: NOW,
    type: BUSINESS_GRAPH_EVENT_TYPES.PARTY_CREATED,
    source: "test",
    payload: {
      party: createBusinessParty({
        id: partyId,
        partyType: "PERSON",
        displayName: "Restart Person",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      }),
    },
  });
}

test("relationship classifications survive destroy-and-rehydrate via runtime snapshots", async () => {
  const workspaceId = "ws_classification_restart";
  const partyId = "party_restart_buyer";
  const activation = buildActivation(workspaceId);
  const persistence = new InMemoryWorkspacePersistence();

  const demoConfiguration = buildEmptyPropertyManagementConfiguration({
    companyName: "Classification Restart Co",
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

  seedParty(stack, partyId);
  ensurePartyRelationship({ stack, partyId, relationshipType: "PROSPECT", nowISO: NOW });
  ensurePartyRelationship({ stack, partyId, relationshipType: "BUYER", nowISO: NOW });

  await persistAffectedRuntimes({
    workspaceId,
    stack,
    integrationPlatform: null,
    kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH],
    persistence,
  });

  const activated = activateWorkspace({
    workspaceId,
    activation,
    nowISO: NOW,
    runtimeSnapshots: await loadRuntimeSnapshotsMap(workspaceId, persistence),
  });

  const graph = activated.operatingStack.businessGraphRuntime;
  const prospect = graph.getRelationship(`rel_PROSPECT_${partyId}`);
  const buyer = graph.getRelationship(`rel_BUYER_${partyId}`);
  assert.equal(String(prospect.status), "active");
  assert.equal(String(buyer.status), "active");
});
