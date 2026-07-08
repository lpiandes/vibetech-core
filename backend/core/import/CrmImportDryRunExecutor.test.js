import assert from "node:assert/strict";
import { test } from "node:test";

import { CrmImportDryRunExecutor } from "./CrmImportDryRunExecutor.js";
import { IMPORT_PLAN_ACTION_TYPES } from "./ImportRunStatus.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { installIndustryPackage } from "../industries/IndustryPackageInstaller.js";
import { CompanyWorkspaceRuntime } from "../company/CompanyWorkspaceRuntime.js";
import { CapabilityRuntime } from "../capabilities/runtime/CapabilityRuntime.js";
import { AutomationRuntime } from "../automations/AutomationRuntime.js";

function installationResult() {
  return installIndustryPackage({
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId: "ws_import_test",
    configuration: {},
    companyRuntime: new CompanyWorkspaceRuntime(),
    capabilityRuntime: new CapabilityRuntime({ seed: null }),
    automationRuntime: new AutomationRuntime({ nowISO: "2026-07-08T00:00:00.000Z" }),
    nowISO: "2026-07-08T00:00:00.000Z",
  });
}

test("dry run plans CREATE_PARTY without consent for email-only row", () => {
  const executor = new CrmImportDryRunExecutor();
  const { rowResults } = executor.execute({
    parsedRows: [{ Email: "new@example.com", Name: "New Person" }],
    columnMap: { Email: "email", Name: "fullName" },
    profile: installationResult().importProfiles[0],
    sourceSystem: "generic_csv",
    importRunId: "run_1",
    canonicalSnapshot: { parties: [], activeRelationshipTypesByPartyId: {}, preferencesByPartyId: {}, importProfileRequestsByPartyId: {} },
    installationResult: installationResult(),
  });

  assert.equal(rowResults.length, 1);
  assert.ok(rowResults[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.CREATE_PARTY));
  assert.ok(!rowResults[0].plannedActions.some((a) => a.type === IMPORT_PLAN_ACTION_TYPES.RECORD_CONSENT));
});
