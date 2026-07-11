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

import { runMigrations } from "../db/migrate.js";
import { closePool } from "../db/pool.js";
import { platformStore } from "../persistence/platformStore.js";
import { BusinessCampaignTemplateService } from "./BusinessCampaignTemplateService.js";
import { hashPassword } from "../services/AuthCredentialService.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../../workspace/activation/activateWorkspace.js";
import { PM_CAMPAIGN_TEMPLATES } from "../../../../industries/property-management/config/campaignOperations.js";
import { buildPackageCampaignSectionRecipe } from "../../../../industries/property-management/config/campaignSectionCatalog.js";

function uid() {
  return randomUUID().slice(0, 8);
}

async function createTestUser({ email, name, password = "password123" }) {
  const passwordHash = await hashPassword(password);
  return platformStore.createUser({ email, name, passwordHash });
}

async function createTestBusiness(name = `Campaign Co ${uid()}`) {
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

test("business templates persist across restart and are tenant-isolated", async () => {
  const businessA = await createTestBusiness(`A ${uid()}`);
  const businessB = await createTestBusiness(`B ${uid()}`);
  const owner = await createTestUser({ email: `owner-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: businessA.id, role: "OWNER" });
  await platformStore.createMembership({ userId: owner.id, businessId: businessB.id, role: "OWNER" });

  const service = new BusinessCampaignTemplateService();
  const sections = buildPackageCampaignSectionRecipe(PM_CAMPAIGN_TEMPLATES[0]);
  const saved = await service.saveTemplate({
    businessId: businessA.id,
    name: "McBride weekly custom",
    subjectLine: "Custom weekly",
    previewText: "Preview",
    sections,
    sourceTemplateId: "weekly_newsletter",
    actorUserId: owner.id,
  });

  assert.ok(saved.id);
  assert.equal(saved.businessId, businessA.id);

  const reloaded = await service.getTemplate(saved.id, businessA.id);
  assert.equal(reloaded?.name, "McBride weekly custom");
  assert.equal(reloaded?.sections.length, sections.length);

  const foreign = await service.getTemplate(saved.id, businessB.id);
  assert.equal(foreign, null);

  const listB = await service.listTemplates(businessB.id);
  assert.equal(listB.some((entry) => entry.id === saved.id), false);
});

test("package templates remain immutable seeds separate from business templates", async () => {
  const packageTemplate = PM_CAMPAIGN_TEMPLATES.find((entry) => entry.id === "weekly_newsletter");
  assert.ok(Object.isFrozen(packageTemplate));
  assert.equal(packageTemplate.origin, undefined);
  const business = await createTestBusiness(`Pkg ${uid()}`);
  const service = new BusinessCampaignTemplateService();
  const saved = await service.saveTemplate({
    businessId: business.id,
    name: "Business copy",
    subjectLine: packageTemplate.defaultSubject,
    sections: buildPackageCampaignSectionRecipe(packageTemplate),
    sourceTemplateId: packageTemplate.id,
  });
  assert.equal(saved.origin, "business");
  assert.equal(saved.sourceTemplateId, "weekly_newsletter");
  assert.notEqual(saved.id, packageTemplate.id);
});
