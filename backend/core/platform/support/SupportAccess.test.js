import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SupportAccessService,
  createInMemorySupportAccessStore,
  resetDefaultSupportAccessServiceForTests,
} from "./SupportAccessService.js";
import { PLATFORM_ROLES } from "../permissions/rolePermissions.js";

const NOW = "2026-07-10T23:45:00.000Z";

test("support access requires reason and retains admin actor identity", () => {
  resetDefaultSupportAccessServiceForTests();
  const store = createInMemorySupportAccessStore({
    businesses: [{ id: "biz_1", name: "Client A" }, { id: "biz_2", name: "Client B" }],
  });
  const service = new SupportAccessService({ store, nowISO: () => NOW });

  const denied = service.enter({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_1",
    reason: "",
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "reason_required");

  const entered = service.enter({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_1",
    reason: "Investigate campaign send failure",
    mode: "read_only",
  });
  assert.equal(entered.ok, true);
  assert.equal(entered.session.permanentMembershipGranted, false);
  assert.equal(entered.session.actorIdentity.userId, "admin_1");
  assert.equal(entered.indicator.active, true);
  assert.ok(store.listAudits().some((entry) => entry.action === "support_access.entered"));

  const resolved = service.resolveAuthorization({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_1",
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.permanentMembership, false);
  assert.ok(resolved.permissions.has("work.view"));
  assert.equal(resolved.permissions.has("settings.manage"), false);

  const otherBusiness = service.resolveAuthorization({
    adminUserId: "admin_1",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_2",
  });
  assert.equal(otherBusiness.ok, false);
  assert.equal(otherBusiness.reason, "support_access_required");

  const exited = service.exit({
    adminUserId: "admin_1",
    businessId: "biz_1",
  });
  assert.equal(exited.ok, true);
  assert.equal(exited.session.status, "ended");
  assert.equal(
    service.resolveAuthorization({
      adminUserId: "admin_1",
      platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
      businessId: "biz_1",
    }).ok,
    false,
  );
});

test("non-admins cannot use support access or directory", () => {
  const service = new SupportAccessService({
    store: createInMemorySupportAccessStore({ businesses: [{ id: "biz_1", name: "Client" }] }),
  });
  assert.equal(service.listBusinessDirectory({
    adminUserId: "user_1",
    platformRole: null,
  }).ok, false);
  assert.equal(service.enter({
    adminUserId: "user_1",
    platformRole: null,
    businessId: "biz_1",
    reason: "Nope",
  }).ok, false);
});

test("elevated support mode still keeps real admin actor and no permanent membership", () => {
  const store = createInMemorySupportAccessStore();
  const service = new SupportAccessService({ store, nowISO: () => NOW });
  const entered = service.enter({
    adminUserId: "admin_2",
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
    businessId: "biz_9",
    reason: "Owner requested configuration help",
    mode: "elevated",
  });
  assert.equal(entered.ok, true);
  assert.ok(entered.permissions.includes("settings.manage"));
  assert.equal(entered.session.actorIdentity.platformRole, "PLATFORM_ADMIN");
  assert.equal(entered.session.permanentMembershipGranted, false);
});
