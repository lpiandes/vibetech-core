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
import { bootstrapPlatformAdmin, hashPassword } from "./services/AuthCredentialService.js";
import { authorizeBusinessAccess, authorizePlatformAdmin, AuthorizationError } from "./authorizeBusinessAccess.js";
import { createBusinessWithOwnerInvite, provisionEmptyBusinessWorkspace } from "./services/PlatformBusinessService.js";
import { createAndDeliverInvitation } from "./services/InvitationService.js";
import { listDevelopmentInvitations } from "./services/DevInvitationService.js";
import { listDevInvitationLinks } from "./services/DevInvitationMailbox.js";
import {
  MEMBERSHIP_ROLES,
  PERMISSIONS,
  PLATFORM_ROLES,
  permissionsForRole,
  hasPermission,
} from "./permissions/rolePermissions.js";
import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";

function uid() {
  return randomUUID().slice(0, 8);
}

async function createTestUser({ email, name, role = null, password = "password123" }) {
  const passwordHash = await hashPassword(password);
  return platformStore.createUser({
    email,
    name,
    passwordHash,
    platformRole: role,
  });
}

before(async () => {
  if (!process.env.DATABASE_URL_TEST) {
    throw new Error("DATABASE_URL_TEST required for platform auth tests.");
  }
  try {
    await withClient((client) => client.query("SELECT 1"));
  } catch {
    throw new Error(
      "Test database unavailable. Create it with: createdb -O vibetech vibetech_test (or see package.json db:test:setup)",
    );
  }
  await runMigrations();
});

after(async () => {
  await closePool();
});

test("bootstrap platform admin creates PLATFORM_ADMIN user", async () => {
  const email = `admin-${uid()}@test.vibetech.local`;
  const result = await bootstrapPlatformAdmin({ email, password: "admin-pass-123", name: "Test Admin" });
  assert.equal(result.created, true);
  assert.equal(result.user.platformRole, PLATFORM_ROLES.PLATFORM_ADMIN);

  const again = await bootstrapPlatformAdmin({ email, password: "admin-pass-123", name: "Test Admin" });
  assert.equal(again.created, false);
});

test("authorizePlatformAdmin denies normal users", async () => {
  const user = await createTestUser({ email: `user-${uid()}@test.vibetech.local`, name: "Normal" });
  await assert.rejects(
    () => authorizePlatformAdmin({ userId: user.id, platformRole: null }),
    (err) => err instanceof AuthorizationError && err.code === "FORBIDDEN",
  );
});

test("create business provisions empty workspace with zero fake facts", async () => {
  const admin = await createTestUser({
    email: `creator-${uid()}@test.vibetech.local`,
    name: "Creator",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  const ownerEmail = `owner-${uid()}@test.vibetech.local`;
  const { business } = await createBusinessWithOwnerInvite({
    name: `Test Co ${uid()}`,
    ownerEmail,
    createdByUserId: admin.id,
  });

  assert.equal(business.kind, "NORMAL");
  assert.equal(business.demoConfigurationId, null);

  const activation = provisionEmptyBusinessWorkspace(business);
  const result = activateWorkspace({
    workspaceId: business.id,
    nowISO: "2026-07-01T00:00:00.000Z",
    activation,
  });

  assert.equal(result.demoBootstrap, null);
  assert.equal(result.ctx.businessGraphRuntime.getParties().length, 0);
  assert.equal(result.ctx.requestRuntime.getRequests().length, 0);
  assert.equal(result.ctx.workRuntime.getWorkItems().length, 0);
  assert.equal(result.ctx.communicationRuntime.getMessages().length, 0);
  assert.equal(result.ctx.teamRuntime.getMembers().filter((m) => m.memberType === "human").length, 0);
  assert.equal(result.ctx.companyRuntime.getKnowledgeRepository().items.length, 0);
});

test("owner invitation creates pending invite with token hash only", async () => {
  const admin = await createTestUser({
    email: `admin2-${uid()}@test.vibetech.local`,
    name: "Admin",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  const ownerEmail = `owner2-${uid()}@test.vibetech.local`;
  const { business, invitation } = await createBusinessWithOwnerInvite({
    name: `Invite Co ${uid()}`,
    ownerEmail,
    createdByUserId: admin.id,
  });

  assert.ok(invitation.invitation.id);
  assert.equal(invitation.invitation.email, ownerEmail);
  assert.ok(invitation.inviteUrl.includes("/invite/"));
  assert.ok(!JSON.stringify(invitation.invitation).includes(invitation.inviteUrl.split("/invite/")[1]));

  const pending = await platformStore.listPendingInvitationsForBusiness(business.id);
  assert.equal(pending.length, 1);
});

test("invitation acceptance creates membership and is idempotent", async () => {
  const admin = await createTestUser({
    email: `admin3-${uid()}@test.vibetech.local`,
    name: "Admin",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  const ownerEmail = `owner3-${uid()}@test.vibetech.local`;
  const { business } = await createBusinessWithOwnerInvite({
    name: `Accept Co ${uid()}`,
    ownerEmail,
    createdByUserId: admin.id,
  });

  const { invitation, token } = await platformStore.createInvitation({
    businessId: business.id,
    email: ownerEmail,
    role: MEMBERSHIP_ROLES.OWNER,
    invitedByUserId: admin.id,
  });

  const user = await createTestUser({ email: ownerEmail, name: "Owner" });
  const first = await platformStore.acceptInvitation({ invitationId: invitation.id, userId: user.id });
  assert.equal(first.alreadyAccepted, false);
  assert.equal(first.membership.role, MEMBERSHIP_ROLES.OWNER);

  const second = await platformStore.acceptInvitation({ invitationId: invitation.id, userId: user.id });
  assert.equal(second.alreadyAccepted, true);
  assert.equal(second.membership.role, MEMBERSHIP_ROLES.OWNER);
});

test("revoked and expired invitations are rejected", async () => {
  const admin = await createTestUser({
    email: `admin4-${uid()}@test.vibetech.local`,
    name: "Admin",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  const business = await platformStore.createBusiness({
    name: `Revoke Co ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "Revoke Co" }),
  });

  const { invitation: revokedInv, token: revokedToken } = await platformStore.createInvitation({
    businessId: business.id,
    email: `revoked-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: admin.id,
  });
  await platformStore.revokeInvitation(revokedInv.id);
  const revoked = await platformStore.getInvitationByToken(revokedToken);
  assert.ok(revoked.revokedAt);

  const { invitation: expiredInv } = await platformStore.createInvitation({
    businessId: business.id,
    email: `expired-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: admin.id,
  });
  await withClient((client) =>
    client.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [expiredInv.id]),
  );
  const expiredRow = await platformStore.getInvitationByToken(
    (await platformStore.createInvitation({
      businessId: business.id,
      email: `expired2-${uid()}@test.vibetech.local`,
      role: MEMBERSHIP_ROLES.EMPLOYEE,
      invitedByUserId: admin.id,
    })).token,
  );
  await withClient((client) =>
    client.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [expiredRow.id]),
  );

  const user = await createTestUser({ email: `emp-${uid()}@test.vibetech.local`, name: "Emp" });
  await assert.rejects(
    () => platformStore.acceptInvitation({ invitationId: revokedInv.id, userId: user.id }),
    /INVITATION_REVOKED/,
  );
  await assert.rejects(
    () => platformStore.acceptInvitation({ invitationId: expiredRow.id, userId: user.id }),
    /INVITATION_EXPIRED/,
  );
});

test("cross-business access is denied for members and unauthenticated users", async () => {
  const admin = await createTestUser({
    email: `admin5-${uid()}@test.vibetech.local`,
    name: "Admin",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });

  const businessA = await platformStore.createBusiness({
    name: `Business A ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "A" }),
  });
  const businessB = await platformStore.createBusiness({
    name: `Business B ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "B" }),
  });

  const ownerA = await createTestUser({ email: `ownera-${uid()}@test.vibetech.local`, name: "Owner A" });
  await platformStore.createMembership({
    userId: ownerA.id,
    businessId: businessA.id,
    role: MEMBERSHIP_ROLES.OWNER,
  });

  await assert.rejects(
    () => authorizeBusinessAccess({ userId: null, businessId: businessA.id }),
    (err) => err instanceof AuthorizationError && err.code === "UNAUTHENTICATED",
  );

  await assert.rejects(
    () => authorizeBusinessAccess({ userId: ownerA.id, businessId: businessB.id }),
    (err) => err instanceof AuthorizationError && err.code === "FORBIDDEN",
  );

  const allowed = await authorizeBusinessAccess({ userId: ownerA.id, businessId: businessA.id });
  assert.equal(allowed.role, MEMBERSHIP_ROLES.OWNER);
  assert.ok(allowed.permissions.has(PERMISSIONS.TEAM_INVITE));

  const adminEntry = await authorizeBusinessAccess({
    userId: admin.id,
    businessId: businessB.id,
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  assert.equal(adminEntry.isPlatformAdmin, true);

  const audits = await withClient((client) =>
    client.query(
      `SELECT * FROM audit_events WHERE actor_user_id = $1 AND action = 'platform_admin.enter_business' AND business_id = $2`,
      [admin.id, businessB.id],
    ),
  );
  assert.ok(audits.rows.length >= 1);
});

test("role permission mapping gates team and settings capabilities", () => {
  assert.ok(hasPermission(MEMBERSHIP_ROLES.OWNER, PERMISSIONS.SETTINGS_MANAGE));
  assert.ok(hasPermission(MEMBERSHIP_ROLES.ADMIN, PERMISSIONS.TEAM_INVITE));
  assert.ok(!hasPermission(MEMBERSHIP_ROLES.EMPLOYEE, PERMISSIONS.TEAM_INVITE));
  assert.ok(!hasPermission(MEMBERSHIP_ROLES.EMPLOYEE, PERMISSIONS.SETTINGS_MANAGE));
  assert.ok(hasPermission(MEMBERSHIP_ROLES.VIEWER, PERMISSIONS.WORK_VIEW));
  assert.equal(permissionsForRole(MEMBERSHIP_ROLES.EMPLOYEE).has(PERMISSIONS.INTEGRATIONS_MANAGE), false);
});

test("employee invitation flow via service", async () => {
  const owner = await createTestUser({ email: `owner6-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await platformStore.createBusiness({
    name: `Team Co ${uid()}`,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: "Team Co" }),
  });
  await platformStore.createMembership({
    userId: owner.id,
    businessId: business.id,
    role: MEMBERSHIP_ROLES.OWNER,
  });

  const employeeEmail = `employee-${uid()}@test.vibetech.local`;
  const invite = await createAndDeliverInvitation({
    businessId: business.id,
    email: employeeEmail,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  assert.equal(invite.invitation.email, employeeEmail);
  assert.equal(invite.delivery.sent, false);

  const employee = await createTestUser({ email: employeeEmail, name: "Employee" });
  await platformStore.acceptInvitation({ invitationId: invite.invitation.id, userId: employee.id });

  const membership = await platformStore.getMembership(employee.id, business.id);
  assert.equal(membership.role, MEMBERSHIP_ROLES.EMPLOYEE);
  assert.equal(membership.status, "ACTIVE");
});

test("development invitation mailbox lists pending invites with local links", async () => {
  const admin = await createTestUser({
    email: `admin-dev-${uid()}@test.vibetech.local`,
    name: "Admin",
    role: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
  const ownerEmail = `owner-dev-${uid()}@manual.local`;
  const { business } = await createBusinessWithOwnerInvite({
    name: `Dev Invite Co ${uid()}`,
    ownerEmail,
    createdByUserId: admin.id,
  });

  const invitations = await listDevelopmentInvitations();
  const match = invitations.find((inv) => inv.businessId === business.id && inv.email === ownerEmail);
  assert.ok(match, "expected pending invitation in development list");
  assert.equal(match.status, "Pending");
  assert.ok(match.hasLink);
  assert.ok(match.inviteUrl?.includes("/invite/"));

  const links = listDevInvitationLinks();
  assert.ok(links[match.id]?.inviteUrl);
});
