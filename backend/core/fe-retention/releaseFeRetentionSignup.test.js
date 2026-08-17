import test from "node:test";
import assert from "node:assert/strict";

import { writeFeRetentionBilling } from "./FeRetentionBilling.js";
import { releaseFeRetentionSignup, releasedVibeKeepEmail } from "./releaseFeRetentionSignup.js";

function memoryStore({ users, businesses, memberships }) {
  return {
    users,
    businesses,
    memberships,
    async getBusinessById(id) {
      return businesses.find((b) => b.id === id) ?? null;
    },
    async archiveBusiness({ businessId }) {
      const business = businesses.find((b) => b.id === businessId);
      if (business) business.status = "ARCHIVED";
      return business;
    },
    async listMembershipsForBusiness(businessId) {
      return memberships.filter((m) => m.businessId === businessId);
    },
    async getUserById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async listBusinessesForUser(userId) {
      const ids = new Set(memberships.filter((m) => m.userId === userId).map((m) => m.businessId));
      return businesses.filter((b) => ids.has(b.id) && String(b.status ?? "").toUpperCase() !== "ARCHIVED");
    },
    async updateUserEmail(userId, email) {
      const user = users.find((u) => u.id === userId);
      if (user) user.email = email;
      return user;
    },
  };
}

test("releaseFeRetentionSignup archives the book and frees a VibeKeep-only owner email", async () => {
  const users = [{ id: "u1", email: "dad@agency.test", platformRole: null }];
  const businesses = [{
    id: "biz_1",
    status: "ACTIVE",
    packageConfiguration: writeFeRetentionBilling({}, { status: "incomplete" }),
  }];
  const memberships = [{ userId: "u1", businessId: "biz_1" }];
  const result = await releaseFeRetentionSignup({
    platformStore: memoryStore({ users, businesses, memberships }),
    businessId: "biz_1",
    nowMs: 1700000000000,
  });
  assert.equal(result.ok, true);
  assert.equal(businesses[0].status, "ARCHIVED");
  assert.equal(users[0].email, releasedVibeKeepEmail("u1", 1700000000000));
  assert.equal(result.releasedEmails[0].from, "dad@agency.test");
});

test("releaseFeRetentionSignup does not rename a platform admin", async () => {
  const users = [{ id: "admin", email: "leo@vtechdevelopment.com", platformRole: "PLATFORM_ADMIN" }];
  const businesses = [{
    id: "biz_1",
    status: "ACTIVE",
    packageConfiguration: writeFeRetentionBilling({}, { status: "incomplete" }),
  }];
  const result = await releaseFeRetentionSignup({
    platformStore: memoryStore({
      users,
      businesses,
      memberships: [{ userId: "admin", businessId: "biz_1" }],
    }),
    businessId: "biz_1",
  });
  assert.equal(result.ok, true);
  assert.equal(users[0].email, "leo@vtechdevelopment.com");
  assert.equal(result.releasedEmails.length, 0);
});

test("releaseFeRetentionSignup refuses a non-VibeKeep business", async () => {
  const result = await releaseFeRetentionSignup({
    platformStore: memoryStore({
      users: [],
      businesses: [{ id: "biz_os", packageConfiguration: { purchasedPackages: ["ai_business_os"] } }],
      memberships: [],
    }),
    businessId: "biz_os",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_vibekeep");
});
