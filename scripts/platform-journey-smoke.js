#!/usr/bin/env node
/**
 * End-to-end platform journey smoke test (API/service layer).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "frontend/.env.local") });

process.env.DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ?? "postgresql://vibetech:vibetech@localhost:5432/vibetech_test";
process.env.VIBETECH_TEST_DB = "1";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { runMigrations } from "../backend/core/platform/db/migrate.js";
import { closePool } from "../backend/core/platform/db/pool.js";
import { platformStore } from "../backend/core/platform/persistence/platformStore.js";
import { bootstrapPlatformAdmin, hashPassword } from "../backend/core/platform/services/AuthCredentialService.js";
import { createBusinessWithOwnerInvite } from "../backend/core/platform/services/PlatformBusinessService.js";
import { authorizeBusinessAccess, AuthorizationError } from "../backend/core/platform/authorizeBusinessAccess.js";
import { createAndDeliverInvitation } from "../backend/core/platform/services/InvitationService.js";
import { MEMBERSHIP_ROLES, PLATFORM_ROLES } from "../backend/core/platform/permissions/rolePermissions.js";

const suffix = Date.now();

await runMigrations();

const admin = await bootstrapPlatformAdmin({
  email: `journey-admin-${suffix}@test.local`,
  password: "journey-admin-pass",
  name: "Journey Admin",
});

const ownerEmail = `journey-owner-${suffix}@test.local`;
const { business, invitation: ownerInvite } = await createBusinessWithOwnerInvite({
  name: `Journey Co ${suffix}`,
  ownerEmail,
  createdByUserId: admin.user.id,
});

const owner = await platformStore.createUser({
  email: ownerEmail,
  name: "Journey Owner",
  passwordHash: await hashPassword("owner-pass-123"),
});
await platformStore.acceptInvitation({
  invitationId: ownerInvite.invitation.id,
  userId: owner.id,
});

const employeeEmail = `journey-employee-${suffix}@test.local`;
const employeeInvite = await createAndDeliverInvitation({
  businessId: business.id,
  email: employeeEmail,
  role: MEMBERSHIP_ROLES.EMPLOYEE,
  invitedByUserId: owner.id,
  inviterRole: MEMBERSHIP_ROLES.OWNER,
  businessName: business.name,
});
const employee = await platformStore.createUser({
  email: employeeEmail,
  name: "Journey Employee",
  passwordHash: await hashPassword("employee-pass-123"),
});
await platformStore.acceptInvitation({
  invitationId: employeeInvite.invitation.id,
  userId: employee.id,
});

const businessB = await createBusinessWithOwnerInvite({
  name: `Other Co ${suffix}`,
  ownerEmail: `other-owner-${suffix}@test.local`,
  createdByUserId: admin.user.id,
});

let denied = false;
try {
  await authorizeBusinessAccess({ userId: owner.id, businessId: businessB.business.id });
} catch (err) {
  denied = err instanceof AuthorizationError && err.code === "FORBIDDEN";
}
if (!denied) throw new Error("Expected cross-business denial");

let supportRequired = false;
try {
  await authorizeBusinessAccess({
    userId: admin.user.id,
    businessId: business.id,
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });
} catch (err) {
  supportRequired = err instanceof AuthorizationError && err.code === "SUPPORT_ACCESS_REQUIRED";
}
if (!supportRequired) throw new Error("Expected support access requirement for platform admin");

const { createDurableSupportAccessService } = await import("../backend/core/platform/support/SupportAccessService.js");
const support = createDurableSupportAccessService(platformStore);
const entered = await support.enter({
  adminUserId: admin.user.id,
  platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  businessId: business.id,
  reason: "Journey smoke support entry",
  mode: "elevated",
});
if (!entered.ok) throw new Error("Expected support access entry to succeed");

const adminAccess = await authorizeBusinessAccess({
  userId: admin.user.id,
  businessId: business.id,
  platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  supportAccessService: support,
});
if (!adminAccess.isPlatformAdmin) throw new Error("Expected platform admin access");
if (!adminAccess.supportAccess?.active) throw new Error("Expected active support access indicator");

const { createDurableAccessRequestService } = await import("../backend/core/access-requests/AccessRequestService.js");
const { applyAccessRequestMembershipGrant } = await import("../backend/core/access-requests/applyAccessRequestMembershipGrant.js");
const access = createDurableAccessRequestService(platformStore);
const accessCreated = await access.requestAccess({
  businessId: business.id,
  requesterUserId: employee.id,
  requestKind: "module",
  requestedModuleId: "performance",
  reason: "Need performance for monthly review",
});
if (!accessCreated.ok) throw new Error("Expected access request create");

const accessAgain = createDurableAccessRequestService(platformStore);
const openAfterRestart = await accessAgain.store.listOpen(business.id);
if (!openAfterRestart.some((row) => row.accessRequestId === accessCreated.accessRequest.accessRequestId)) {
  throw new Error("Expected durable access request to survive service recreation");
}

const decided = await accessAgain.decide({
  businessId: business.id,
  accessRequestId: accessCreated.accessRequest.accessRequestId,
  actorUserId: owner.id,
  actorRole: MEMBERSHIP_ROLES.OWNER,
  decision: "approved",
  membershipUpdater: async (grant) => {
    const applied = await applyAccessRequestMembershipGrant(platformStore, {
      ...grant,
      approverUserId: owner.id,
    });
    if (!applied?.ok) throw new Error(`Expected membership grant apply: ${applied?.reason}`);
  },
});
if (!decided.ok) throw new Error("Expected access request approval");

const employeeMembership = await platformStore.getMembership(employee.id, business.id);
if (!employeeMembership || employeeMembership.role === MEMBERSHIP_ROLES.EMPLOYEE) {
  throw new Error(`Expected employee role bump after access approval, got ${employeeMembership?.role}`);
}

const foreignOpen = await accessAgain.store.listOpen(businessB.business.id);
if (foreignOpen.some((row) => row.accessRequestId === accessCreated.accessRequest.accessRequestId)) {
  throw new Error("Access request leaked across tenants");
}

console.log("Journey smoke test passed.");
console.log(`  business: ${business.name} (${business.id})`);
console.log(`  owner invite: ${ownerInvite.inviteUrl}`);
console.log(`  employee invite: ${employeeInvite.inviteUrl}`);
console.log(`  access request: ${accessCreated.accessRequest.accessRequestId} → ${employeeMembership.role}`);

await closePool();
