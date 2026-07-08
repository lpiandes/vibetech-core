import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { runMigrations } from "./db/migrate.js";
import { closePool, withClient } from "./db/pool.js";
import { platformStore } from "./persistence/PostgresPlatformStore.js";
import { hashPassword } from "./services/AuthCredentialService.js";
import { MEMBERSHIP_ROLES } from "./permissions/rolePermissions.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";

function uid() {
  return randomUUID().slice(0, 8);
}

async function createTestUser({ email, name }) {
  const passwordHash = await hashPassword("password123");
  return platformStore.createUser({ email, name, passwordHash });
}

async function createTestBusiness(name = `Checklist Co ${uid()}`) {
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

test("team invite checklist incomplete with owner only", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-only-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, false);
});

test("team invite checklist complete with pending non-owner invitation", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-pend-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  await platformStore.createInvitation({
    businessId: business.id,
    email: `manager-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.MANAGER,
    invitedByUserId: owner.id,
  });
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, true);
});

test("team invite checklist complete with accepted non-owner member", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-emp-${uid()}@test.vibetech.local`, name: "Owner" });
  const employee = await createTestUser({ email: `employee-${uid()}@test.vibetech.local`, name: "Employee" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  await platformStore.createMembership({
    userId: employee.id,
    businessId: business.id,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
  });
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, true);
});

test("team invite checklist incomplete with revoked non-owner invitation only", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-rev-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  const { invitation } = await platformStore.createInvitation({
    businessId: business.id,
    email: `revoked-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
  });
  await platformStore.revokeInvitation(invitation.id);
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, false);
});

test("team invite checklist incomplete with expired non-owner invitation only", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-exp-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  const { invitation } = await platformStore.createInvitation({
    businessId: business.id,
    email: `expired-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
  });
  await withClient((client) =>
    client.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [invitation.id]),
  );
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, false);
});

test("team invite checklist ignores pending owner invitation", async () => {
  const business = await createTestBusiness();
  const owner = await createTestUser({ email: `owner-reinvite-${uid()}@test.vibetech.local`, name: "Owner" });
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  await platformStore.createInvitation({
    businessId: business.id,
    email: `owner-reinvite-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.OWNER,
    invitedByUserId: owner.id,
  });
  const complete = await platformStore.isTeamInviteChecklistComplete(business.id);
  assert.equal(complete, false);
});
