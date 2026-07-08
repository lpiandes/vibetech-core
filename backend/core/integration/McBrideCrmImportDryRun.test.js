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
import { CrmImportDryRunExecutor } from "../import/CrmImportDryRunExecutor.js";
import { installIndustryPackage } from "../industries/IndustryPackageInstaller.js";
import { IMPORT_PLAN_ACTION_TYPES } from "../import/ImportRunStatus.js";
import { CanonicalStateReader } from "../import/CanonicalStateReader.js";

const NOW = "2026-07-08T14:00:00.000Z";

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({ companyName: "McBride Import", workspaceId });
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

test("McBride dry run matches existing prospect by email as UPDATE not CREATE", async () => {
  const workspaceId = "ws_mcbride_import_dry";
  const { stack, integrationPlatform, installationResult } = buildStack(workspaceId);
  await connectBusinessEmailDev({ integrationPlatform, workspaceId, nowISO: NOW });

  const inquiry = await runProspectInquiryOperatingLoop({
    stack,
    integrationPlatform,
    workspaceId,
    nowISO: NOW,
    inquiry: { name: "Loop Prospect", email: "loop.prospect@example.com", message: "Hello" },
  });
  assert.equal(inquiry.ok, true);

  const beforeHash = JSON.stringify(
    exportRuntimeSnapshots({ stack, integrationPlatform, kinds: PROSPECT_LOOP_SNAPSHOT_KINDS }),
  );
  const beforePartyCount = stack.businessGraphRuntime.getParties().length;

  const reader = new CanonicalStateReader({ stack });
  const canonicalSnapshot = reader.readSnapshot();
  const executor = new CrmImportDryRunExecutor();
  const profile = installationResult.importProfiles.find((p) => p.profileId === "follow_up_boss_contacts");

  const { rowResults } = executor.execute({
    parsedRows: [{ "Contact Id": "999", Email: "loop.prospect@example.com", Name: "Loop Prospect", Status: "buyer" }],
    columnMap: { "Contact Id": "externalContactId", Email: "email", Name: "fullName", Status: "relationshipType" },
    profile,
    sourceSystem: "follow_up_boss",
    importRunId: "run_test",
    canonicalSnapshot,
    installationResult,
  });

  assert.equal(rowResults.length, 1);
  assert.ok(!rowResults[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY));
  assert.equal(rowResults[0].resolvedPartyId, inquiry.partyId);
  assert.ok(
    rowResults[0].plannedActions.some(
      (a) =>
        a.type === IMPORT_PLAN_ACTION_TYPES.UPDATE_PARTY ||
        a.type === IMPORT_PLAN_ACTION_TYPES.ADD_RELATIONSHIP,
    ),
  );

  const afterHash = JSON.stringify(
    exportRuntimeSnapshots({ stack, integrationPlatform, kinds: PROSPECT_LOOP_SNAPSHOT_KINDS }),
  );
  assert.equal(beforeHash, afterHash);
  assert.equal(stack.businessGraphRuntime.getParties().length, beforePartyCount);
});

test("invalid package relationship type produces row error", () => {
  const { stack, installationResult } = buildStack("ws_invalid_rel");
  const reader = new CanonicalStateReader({ stack });
  const executor = new CrmImportDryRunExecutor();
  const profile = installationResult.importProfiles[0];

  const { rowResults } = executor.execute({
    parsedRows: [{ Email: "x@example.com", Status: "not_a_real_type" }],
    columnMap: { Email: "email", Status: "relationshipType" },
    profile,
    sourceSystem: "generic_csv",
    importRunId: "run_test",
    canonicalSnapshot: reader.readSnapshot(),
    installationResult,
  });

  assert.ok(rowResults[0].errors.some((e) => e.code === "invalid_relationship_type"));
});
