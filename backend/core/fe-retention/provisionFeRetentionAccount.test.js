import test from "node:test";
import assert from "node:assert/strict";

import { validateFeRetentionSignup, provisionFeRetentionAccount } from "./provisionFeRetentionAccount.js";
import { readFeRetentionBilling } from "./FeRetentionBilling.js";

test("validateFeRetentionSignup requires name, email, agency, and 8+ password", () => {
  assert.equal(validateFeRetentionSignup({ name: "A", email: "bad", password: "short", agencyName: "X" }).ok, false);
  const ok = validateFeRetentionSignup({
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.email, "ada@agency.test");
});

function memoryStore() {
  const users = [];
  const businesses = [];
  const memberships = [];
  const installations = new Map();
  return {
    users,
    businesses,
    memberships,
    async getUserByEmail(email) {
      return users.find((u) => u.email === email) ?? null;
    },
    async createUser(row) {
      const user = { id: "user_1", ...row };
      users.push(user);
      return user;
    },
    async createBusiness(row) {
      businesses.push(row);
      return row;
    },
    async createMembership(row) {
      memberships.push(row);
      return row;
    },
    async getBusinessById(id) {
      return businesses.find((b) => b.id === id) ?? null;
    },
    async getBusinessOSInstallation(id) {
      return installations.get(id) ?? null;
    },
    async upsertBusinessOSInstallation(row) {
      installations.set(row.businessId, row);
      return row;
    },
  };
}

test("provisionFeRetentionAccount creates owner + incomplete billing", async () => {
  const platformStore = memoryStore();
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword: async (password) => `hash:${password}`,
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(result.ok, true);
  assert.equal(platformStore.users.length, 1);
  assert.equal(platformStore.memberships[0].role, "OWNER");
  const billing = readFeRetentionBilling(platformStore.businesses[0].packageConfiguration);
  assert.equal(billing.status, "incomplete");
  assert.equal(billing.allowsDashboard, false);
});

test("provisionFeRetentionAccount refuses duplicate email", async () => {
  const platformStore = memoryStore();
  platformStore.users.push({ email: "ada@agency.test" });
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword: async () => "x",
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "email_taken");
});
