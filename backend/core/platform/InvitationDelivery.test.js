import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, before, after, beforeEach, afterEach } from "node:test";

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-auth-secret-for-invitation-delivery";

import { runMigrations } from "./db/migrate.js";
import { closePool, withClient } from "./db/pool.js";
import { platformStore } from "./persistence/PostgresPlatformStore.js";
import { hashPassword } from "./services/AuthCredentialService.js";
import { MEMBERSHIP_ROLES } from "./permissions/rolePermissions.js";
import { buildEmptyPropertyManagementConfiguration } from "../../../industries/property-management/config/buildEmptyPropertyManagementConfiguration.js";
import { PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import {
  createAndDeliverInvitation,
  resendPendingInvitation,
} from "./services/InvitationService.js";
import { AuthorizationError } from "./authorizeBusinessAccess.js";
import { authorizeBusinessAccess } from "./authorizeBusinessAccess.js";
import {
  resetInvitationDeliveryProviderForTests,
  setInvitationDeliveryProviderForTests,
} from "./delivery/createInvitationDeliveryProvider.js";
import { InvitationDeliveryProvider } from "./delivery/InvitationDeliveryProvider.js";
import { listDevelopmentInvitations } from "./services/DevInvitationService.js";
import { listDevInvitationLinks } from "./services/DevInvitationMailbox.js";

function uid() {
  return randomUUID().slice(0, 8);
}

async function createTestUser({ email, name }) {
  const passwordHash = await hashPassword("password123");
  return platformStore.createUser({ email, name, passwordHash });
}

async function createTestBusiness(name = `Delivery Co ${uid()}`) {
  return platformStore.createBusiness({
    name,
    kind: "NORMAL",
    industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID,
    packageConfiguration: buildEmptyPropertyManagementConfiguration({ companyName: name }),
  });
}

class MockInvitationDeliveryProvider extends InvitationDeliveryProvider {
  constructor({ fail = false } = {}) {
    super();
    this.fail = fail;
    this.sent = [];
  }

  async send(payload) {
    if (this.fail) {
      return {
        sent: false,
        reason: "provider_error",
        message: "We could not send the invitation email. Try again in a moment.",
      };
    }
    this.sent.push(payload);
    return { sent: true, reason: "mock", providerMessageId: `mock-${this.sent.length}` };
  }
}

before(async () => {
  await runMigrations();
});

after(async () => {
  await closePool();
});

beforeEach(() => {
  resetInvitationDeliveryProviderForTests();
});

afterEach(() => {
  resetInvitationDeliveryProviderForTests();
});

test("successful provider delivery sends branded invitation email payload", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-deliver-${uid()}@test.vibetech.local`, name: "Owner Pat" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const inviteEmail = `employee-deliver-${uid()}@test.vibetech.local`;
  const result = await createAndDeliverInvitation({
    businessId: business.id,
    email: inviteEmail,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  assert.equal(result.delivery.sent, true);
  assert.equal(provider.sent.length, 1);
  assert.equal(provider.sent[0].to, inviteEmail);
  assert.match(provider.sent[0].subject, /Join/);
  assert.match(provider.sent[0].html, /Accept invitation/);
  assert.match(provider.sent[0].text, /Accept your invitation:/);
  assert.match(provider.sent[0].text, new RegExp(business.name));
  assert.match(provider.sent[0].text, /Owner Pat invited you/);
  assert.equal(result.inviteUrl, undefined);
});

test("provider failure preserves invitation and delivery token", async () => {
  const provider = new MockInvitationDeliveryProvider({ fail: true });
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-fail-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const inviteEmail = `employee-fail-${uid()}@test.vibetech.local`;
  const result = await createAndDeliverInvitation({
    businessId: business.id,
    email: inviteEmail,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  assert.equal(result.delivery.sent, false);
  const pending = await platformStore.listPendingInvitationsForBusiness(business.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].email, inviteEmail);
  const token = await platformStore.getInvitationDeliveryToken(pending[0].id);
  assert.ok(token);
});

test("retry of existing pending invitation sends same invitation without creating duplicate", async () => {
  const provider = new MockInvitationDeliveryProvider({ fail: true });
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-retry-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const inviteEmail = `employee-retry-${uid()}@test.vibetech.local`;
  const created = await createAndDeliverInvitation({
    businessId: business.id,
    email: inviteEmail,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  provider.fail = false;
  const resent = await resendPendingInvitation({
    businessId: business.id,
    invitationId: created.invitation.id,
    actorUserId: owner.id,
  });

  assert.equal(resent.delivery.sent, true);
  const pending = await platformStore.listPendingInvitationsForBusiness(business.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, created.invitation.id);
  assert.equal(provider.sent.length, 1);
});

test("accepted invitation cannot be resent", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-accepted-${uid()}@test.vibetech.local`, name: "Owner" });
  const employee = await createTestUser({ email: `employee-accepted-${uid()}@test.vibetech.local`, name: "Employee" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const created = await createAndDeliverInvitation({
    businessId: business.id,
    email: employee.email,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  await platformStore.acceptInvitation({ invitationId: created.invitation.id, userId: employee.id });

  await assert.rejects(
    () =>
      resendPendingInvitation({
        businessId: business.id,
        invitationId: created.invitation.id,
        actorUserId: owner.id,
      }),
    (err) => err instanceof AuthorizationError && err.code === "CONFLICT",
  );
});

test("revoked invitation cannot be resent", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-revoked-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const created = await createAndDeliverInvitation({
    businessId: business.id,
    email: `revoked-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  await platformStore.revokeInvitation(created.invitation.id);

  await assert.rejects(
    () =>
      resendPendingInvitation({
        businessId: business.id,
        invitationId: created.invitation.id,
        actorUserId: owner.id,
      }),
    (err) => err instanceof AuthorizationError && err.code === "CONFLICT",
  );
});

test("expired invitation cannot be resent", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-expired-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const created = await createAndDeliverInvitation({
    businessId: business.id,
    email: `expired-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  await withClient((client) =>
    client.query(`UPDATE invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [created.invitation.id]),
  );

  await assert.rejects(
    () =>
      resendPendingInvitation({
        businessId: business.id,
        invitationId: created.invitation.id,
        actorUserId: owner.id,
      }),
    (err) => err instanceof AuthorizationError && err.code === "CONFLICT",
  );
});

test("development copy-link behavior still works without external email", async () => {
  resetInvitationDeliveryProviderForTests();

  const owner = await createTestUser({ email: `owner-devlink-${uid()}@test.vibetech.local`, name: "Owner" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });

  const inviteEmail = `devlink-${uid()}@manual.local`;
  const created = await createAndDeliverInvitation({
    businessId: business.id,
    email: inviteEmail,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: owner.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: business.name,
  });

  assert.equal(created.delivery.sent, false);
  assert.ok(created.inviteUrl?.includes("/invite/"));

  const invitations = await listDevelopmentInvitations({ includeTestData: true });
  const match = invitations.find((inv) => inv.id === created.invitation.id);
  assert.ok(match?.hasLink);
  const links = listDevInvitationLinks();
  assert.ok(links[created.invitation.id]?.inviteUrl);
});

test("existing member cannot be invited", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const owner = await createTestUser({ email: `owner-dup-${uid()}@test.vibetech.local`, name: "Owner" });
  const employee = await createTestUser({ email: `employee-dup-${uid()}@test.vibetech.local`, name: "Employee" });
  const business = await createTestBusiness();
  await platformStore.createMembership({ userId: owner.id, businessId: business.id, role: MEMBERSHIP_ROLES.OWNER });
  await platformStore.createMembership({
    userId: employee.id,
    businessId: business.id,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
  });

  await assert.rejects(
    () =>
      createAndDeliverInvitation({
        businessId: business.id,
        email: employee.email,
        role: MEMBERSHIP_ROLES.MANAGER,
        invitedByUserId: owner.id,
        inviterRole: MEMBERSHIP_ROLES.OWNER,
        businessName: business.name,
      }),
    (err) => err instanceof AuthorizationError && err.code === "CONFLICT",
  );
});

test("cross-tenant resend remains blocked", async () => {
  const provider = new MockInvitationDeliveryProvider();
  setInvitationDeliveryProviderForTests(provider);

  const ownerA = await createTestUser({ email: `owner-a-${uid()}@test.vibetech.local`, name: "Owner A" });
  const ownerB = await createTestUser({ email: `owner-b-${uid()}@test.vibetech.local`, name: "Owner B" });
  const businessA = await createTestBusiness("Business A");
  const businessB = await createTestBusiness("Business B");
  await platformStore.createMembership({ userId: ownerA.id, businessId: businessA.id, role: MEMBERSHIP_ROLES.OWNER });
  await platformStore.createMembership({ userId: ownerB.id, businessId: businessB.id, role: MEMBERSHIP_ROLES.OWNER });

  const created = await createAndDeliverInvitation({
    businessId: businessA.id,
    email: `cross-${uid()}@test.vibetech.local`,
    role: MEMBERSHIP_ROLES.EMPLOYEE,
    invitedByUserId: ownerA.id,
    inviterRole: MEMBERSHIP_ROLES.OWNER,
    businessName: businessA.name,
  });

  await assert.rejects(
    () =>
      resendPendingInvitation({
        businessId: businessB.id,
        invitationId: created.invitation.id,
        actorUserId: ownerB.id,
      }),
    (err) => err instanceof AuthorizationError && err.code === "NOT_FOUND",
  );

  await assert.rejects(
    () => authorizeBusinessAccess({ userId: ownerB.id, businessId: businessA.id }),
    (err) => err instanceof AuthorizationError,
  );
});
