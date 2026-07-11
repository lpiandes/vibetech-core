import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

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
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { exportMcBrideBusinessOSSpecification } from "./McBrideBusinessOSAdapter.js";
import { BusinessOSCompiler } from "./BusinessOSCompiler.js";

function uid() {
  return randomUUID().slice(0, 8);
}

async function createTestUser({ email, name, password = "password123" }) {
  const passwordHash = await hashPassword(password);
  return platformStore.createUser({ email, name, passwordHash });
}

async function createTestBusiness(name = `OS Co ${uid()}`) {
  return platformStore.createBusiness({
    name,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: name }),
  });
}

before(async () => {
  await runMigrations();
});

after(async () => {
  await closePool();
});

test("business OS specifications and installations are tenant-isolated", async () => {
  const businessA = await createTestBusiness(`A ${uid()}`);
  const businessB = await createTestBusiness(`B ${uid()}`);
  const owner = await createTestUser({ email: `owner-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: businessA.id, role: "OWNER" });
  await platformStore.createMembership({ userId: owner.id, businessId: businessB.id, role: "OWNER" });

  const spec = exportMcBrideBusinessOSSpecification({ businessId: businessA.id });
  const row = await platformStore.upsertBusinessOSSpecification({
    id: `row_${uid()}`,
    businessId: businessA.id,
    specificationId: spec.specificationId,
    specificationVersion: spec.specificationVersion,
    status: "validated",
    contentHash: spec.contentHash,
    specification: spec,
    createdByUserId: owner.id,
    updatedByUserId: owner.id,
  });
  assert.equal(row.businessId, businessA.id);

  const foreign = await platformStore.getBusinessOSSpecification({
    businessId: businessB.id,
    specificationId: spec.specificationId,
  });
  assert.equal(foreign, null);

  const plan = new BusinessOSCompiler().compile(spec).plan;
  const installation = await platformStore.upsertBusinessOSInstallation({
    id: `install_${uid()}`,
    businessId: businessA.id,
    specificationRowId: row.id,
    specificationId: spec.specificationId,
    specificationVersion: spec.specificationVersion,
    specificationContentHash: spec.contentHash,
    planId: plan.planId,
    status: "installed",
    plan,
    actionCheckpoints: [{ actionId: plan.actions[0].actionId, status: "applied" }],
    configuration: { modules: [{ moduleId: "properties" }] },
    history: [{ at: new Date().toISOString() }],
    actorUserId: owner.id,
    installedAt: new Date().toISOString(),
  });
  assert.equal(installation.businessId, businessA.id);
  assert.equal(await platformStore.getBusinessOSInstallation(businessB.id), null);

  const proposal = await platformStore.upsertBusinessCapabilityProposal({
    id: `prop_row_${uid()}`,
    businessId: businessA.id,
    proposalId: `prop_${uid()}`,
    requestedOutcome: "Travel vendor booking",
    evidence: [{ kind: "discovery" }],
    whyInsufficient: "No reusable booking capability yet.",
    createdByUserId: owner.id,
  });
  assert.equal(proposal.businessId, businessA.id);
  assert.equal(await platformStore.getBusinessCapabilityProposal(proposal.proposalId, businessB.id), null);

  const session = await platformStore.upsertBusinessBuilderSession({
    id: `session_${uid()}`,
    businessId: businessA.id,
    status: "discovery",
    mode: "operator",
    discovery: { answers: [] },
    evidence: [],
    createdByUserId: owner.id,
  });
  assert.equal(session.businessId, businessA.id);
  assert.equal(await platformStore.getBusinessBuilderSession(session.id, businessB.id), null);
});
