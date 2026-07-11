import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test, before, after, beforeEach } from "node:test";

import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { runMigrations } from "../platform/db/migrate.js";
import { closePool } from "../platform/db/pool.js";
import { platformStore } from "../platform/persistence/platformStore.js";
import { hashPassword } from "../platform/services/AuthCredentialService.js";
import { CrmImportOrchestrationService } from "./CrmImportOrchestrationService.js";
import { LocalFilesystemImportStorage } from "./storage/LocalFilesystemImportStorage.js";
import { ImportArtifactStore } from "./storage/ImportArtifactStore.js";
import { ImportRunRepository } from "./persistence/ImportRunRepository.js";
import { buildPropertyManagementWorkspaceStack } from "../integration/PropertyManagementScenarioHarness.js";
import { installIndustryPackage } from "../industries/IndustryPackageInstaller.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { exportRuntimeSnapshots } from "../persistence/exportRuntimeSnapshots.js";
import { PROSPECT_LOOP_SNAPSHOT_KINDS } from "../persistence/RuntimeSnapshotKinds.js";
import { CanonicalStateReader } from "./CanonicalStateReader.js";

function uid() {
  return randomUUID().slice(0, 8);
}

let testStorageRoot = "";

function makeService() {
  process.env.IMPORT_STORAGE_ROOT = testStorageRoot;
  return new CrmImportOrchestrationService({
    repository: new ImportRunRepository(),
    artifactStore: new ImportArtifactStore({ storage: new LocalFilesystemImportStorage() }),
  });
}

function buildStack(workspaceId) {
  const demoConfiguration = buildEmptyPropertyManagementConfiguration({ companyName: "Import Co", workspaceId });
  const stack = buildPropertyManagementWorkspaceStack({
    nowISO: "2026-07-08T14:00:00.000Z",
    workspaceId,
    installPackage: true,
    demoConfiguration,
  });
  const installationResult = installIndustryPackage({
    industryPackage: PROPERTY_MANAGEMENT_PACKAGE,
    workspaceId,
    configuration: demoConfiguration,
    companyRuntime: stack.companyRuntime,
    capabilityRuntime: stack.capabilityRuntime,
    automationRuntime: stack.automationRuntime,
    nowISO: "2026-07-08T14:00:00.000Z",
  });
  return { stack, installationResult };
}

async function createBusiness(name = `Import Co ${uid()}`) {
  return platformStore.createBusiness({
    name,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: name }),
  });
}

before(async () => {
  testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vibetech-import-test-"));
  process.env.IMPORT_STORAGE_ROOT = testStorageRoot;
  await runMigrations();
});

beforeEach(() => {
  fs.rmSync(testStorageRoot, { recursive: true, force: true });
  fs.mkdirSync(testStorageRoot, { recursive: true });
});

after(async () => {
  fs.rmSync(testStorageRoot, { recursive: true, force: true });
  await closePool();
});

test("orchestration upload inspect map dry-run report flow", async () => {
  const business = await createBusiness();
  const owner = await platformStore.createUser({
    email: `owner-${uid()}@test.vibetech.local`,
    name: "Owner",
    passwordHash: await hashPassword("password123"),
  });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: "OWNER" });

  const { stack, installationResult } = buildStack(business.id);
  const service = makeService();
  const csv = Buffer.from(`Contact Id,Email,Name,Status\n100,jane@example.com,Jane Doe,buyer`);

  const uploaded = await service.upload({
    businessId: business.id,
    userId: owner.id,
    buffer: csv,
    filename: "contacts.csv",
    mimeType: "text/csv",
    sourceSystem: "follow_up_boss",
    installationResult,
  });
  assert.equal(uploaded.importRun.status, "uploaded");

  const inspected = await service.inspect({
    businessId: business.id,
    runId: uploaded.importRun.id,
    installationResult,
  });
  assert.equal(inspected.rowCount, 1);
  assert.ok(inspected.detectedProfile?.profileId);

  await service.mapColumns({
    businessId: business.id,
    runId: uploaded.importRun.id,
    profileId: "follow_up_boss_contacts",
    columnMapping: inspected.detectedProfile.suggestedColumnMap,
    installationResult,
  });

  const beforeParties = stack.businessGraphRuntime.getParties().length;
  const beforeHash = JSON.stringify(
    exportRuntimeSnapshots({ stack, integrationPlatform: null, kinds: PROSPECT_LOOP_SNAPSHOT_KINDS }),
  );

  const dryRun = await service.dryRun({
    businessId: business.id,
    runId: uploaded.importRun.id,
    stack,
    installationResult,
  });

  assert.equal(dryRun.dryRun.status, "dry_run_complete");
  assert.equal(dryRun.dryRun.stats.totalRows, 1);
  assert.equal(stack.businessGraphRuntime.getParties().length, beforeParties);

  const afterHash = JSON.stringify(
    exportRuntimeSnapshots({ stack, integrationPlatform: null, kinds: PROSPECT_LOOP_SNAPSHOT_KINDS }),
  );
  assert.equal(beforeHash, afterHash);

  const report = await service.getReport({ businessId: business.id, runId: uploaded.importRun.id });
  assert.equal(report.totalRows, 1);
  assert.equal(report.rows[0].rowNumber, 1);
});

test("tenant isolation rejects foreign business run access", async () => {
  const businessA = await createBusiness("Tenant A");
  const businessB = await createBusiness("Tenant B");
  const { installationResult } = buildStack(businessA.id);
  const service = makeService();
  const csv = Buffer.from("Email\na@example.com\n");

  const uploaded = await service.upload({
    businessId: businessA.id,
    userId: null,
    buffer: csv,
    filename: "contacts.csv",
    mimeType: "text/csv",
    sourceSystem: "generic_csv",
    installationResult,
  });

  await assert.rejects(() => service.getRun(businessB.id, uploaded.importRun.id), /not found/i);
});

test("repeat dry-run replaces row results with equivalent stats", async () => {
  const business = await createBusiness();
  const { stack, installationResult } = buildStack(business.id);
  const service = makeService();
  const csv = Buffer.from("Email,Name\nrepeat@example.com,Repeat Person\n");

  const uploaded = await service.upload({
    businessId: business.id,
    userId: null,
    buffer: csv,
    filename: "contacts.csv",
    mimeType: "text/csv",
    sourceSystem: "generic_csv",
    installationResult,
  });

  await service.inspect({ businessId: business.id, runId: uploaded.importRun.id, installationResult });
  await service.mapColumns({
    businessId: business.id,
    runId: uploaded.importRun.id,
    columnMapping: { Email: "email", Name: "fullName" },
    installationResult,
  });

  const first = await service.dryRun({ businessId: business.id, runId: uploaded.importRun.id, stack, installationResult });
  const second = await service.dryRun({ businessId: business.id, runId: uploaded.importRun.id, stack, installationResult });

  assert.deepEqual(first.dryRun.stats, second.dryRun.stats);
  const count = await service.repository.countRowResults(uploaded.importRun.id);
  assert.equal(count, 1);
});
