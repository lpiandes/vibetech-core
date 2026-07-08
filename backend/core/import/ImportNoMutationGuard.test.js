import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { createIntegrationPlatform } from "../integrations/createIntegrationPlatform.js";
import { installPackageEmployees } from "../industries/install/installPackageEmployees.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { connectBusinessEmailDev } from "../integrations/use-cases/connectBusinessEmailDev.js";
import { runProspectInquiryOperatingLoop } from "../integration/ProspectInquiryOperatingLoopService.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { PROSPECT_LOOP_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { CrmImportDryRunExecutor } from "./CrmImportDryRunExecutor.js";
import { CanonicalStateReader } from "./CanonicalStateReader.js";
import { installIndustryPackage } from "../industries/IndustryPackageInstaller.js";

const NOW = "2026-07-08T14:00:00.000Z";

function snapshotHashes(stack, integrationPlatform) {
  return JSON.stringify(
    exportRuntimeSnapshots({ stack, integrationPlatform, kinds: PROSPECT_LOOP_SNAPSHOT_KINDS }),
  );
}

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({ companyName: "Guard Co", workspaceId });
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
  const installationResult = installIndustryPackage({
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId,
    configuration: demoConfiguration,
    companyRuntime: stack.companyRuntime,
    capabilityRuntime: stack.capabilityRuntime,
    automationRuntime: stack.automationRuntime,
    nowISO: NOW,
  });
  return { stack, integrationPlatform, installationResult };
}

test("ImportNoMutationGuard: dry run does not mutate canonical runtime snapshots", async () => {
  const workspaceId = "ws_import_no_mutation";
  const { stack, integrationPlatform, installationResult } = buildStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: { name: "Guard Prospect", email: "guard@example.com", message: "Hi" },
  });

  const before = {
    hash: snapshotHashes(stack, integrationPlatform),
    parties: stack.businessGraphRuntime.getParties().length,
    requests: stack.requestRuntime.getRequests().length,
    preferences: stack.communicationPreferenceRuntime.getPreferences().length,
    interactions: stack.interactionRuntime.getInteractions().length,
  };

  const reader = new CanonicalStateReader({ stack });
  const executor = new CrmImportDryRunExecutor();
  const profile = installationResult.importProfiles[0];

  executor.execute({
    parsedRows: [
      { Email: "guard@example.com", Name: "Guard Prospect Updated", Status: "buyer", "Email Opt In": "yes" },
      { Email: "brandnew@example.com", Name: "Brand New", Status: "prospect" },
    ],
    columnMap: {
      Email: "email",
      Name: "fullName",
      Status: "relationshipType",
      "Email Opt In": "emailOptIn",
    },
    profile,
    sourceSystem: "generic_csv",
    importRunId: "run_guard",
    canonicalSnapshot: reader.readSnapshot(),
    installationResult,
  });

  const after = {
    hash: snapshotHashes(stack, integrationPlatform),
    parties: stack.businessGraphRuntime.getParties().length,
    requests: stack.requestRuntime.getRequests().length,
    preferences: stack.communicationPreferenceRuntime.getPreferences().length,
    interactions: stack.interactionRuntime.getInteractions().length,
  };

  assert.equal(before.hash, after.hash);
  assert.equal(before.parties, after.parties);
  assert.equal(before.requests, after.requests);
  assert.equal(before.preferences, after.preferences);
  assert.equal(before.interactions, after.interactions);
});
