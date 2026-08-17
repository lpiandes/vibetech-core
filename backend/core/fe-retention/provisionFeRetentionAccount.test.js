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
      const normalized = String(email).trim().toLowerCase();
      return users.find((u) => u.email === normalized) ?? null;
    },
    async createUser(row) {
      const user = { id: `user_${users.length + 1}`, ...row, email: String(row.email).toLowerCase() };
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
    async listBusinessesForUser(userId) {
      const ids = new Set(memberships.filter((m) => m.userId === userId).map((m) => m.businessId));
      return businesses.filter((b) => ids.has(b.id));
    },
    async updateBusinessPackageConfiguration({ businessId, packageConfiguration }) {
      const business = businesses.find((b) => b.id === businessId);
      if (business) business.packageConfiguration = packageConfiguration;
      return business;
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

const hashPassword = async (password) => `hash:${password}`;
const verifyPassword = async (password, hash) => hash === `hash:${password}`;

test("provisionFeRetentionAccount creates owner + incomplete billing", async () => {
  const platformStore = memoryStore();
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
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

test("provisionFeRetentionAccount refuses duplicate email when the password does not match", async () => {
  const platformStore = memoryStore();
  platformStore.users.push({ email: "ada@agency.test", passwordHash: "hash:other" });
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "email_taken");
});

test("retrying signup with the same email and password resumes the unpaid book", async () => {
  const platformStore = memoryStore();
  const first = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  const second = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.resumed, true);
  assert.equal(second.businessId, first.businessId);
  assert.equal(platformStore.users.length, 1);
  assert.equal(platformStore.businesses.length, 1);
});

test("existing login with no VibeKeep book gets a book attached on signup", async () => {
  const platformStore = memoryStore();
  platformStore.users.push({
    id: "user_os",
    email: "ada@agency.test",
    passwordHash: "hash:password1",
  });
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "ada@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(result.ok, true);
  assert.equal(result.resumed, true);
  assert.equal(platformStore.users.length, 1);
  assert.equal(platformStore.businesses.length, 1);
  assert.equal(platformStore.memberships[0].userId, "user_os");
});

test("valid promo code grants complimentary access", async () => {
  const platformStore = memoryStore();
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "promo@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
    promoCode: "Crete88",
  });
  assert.equal(result.ok, true);
  assert.equal(result.complimentary, true);
  const billing = readFeRetentionBilling(platformStore.businesses[0].packageConfiguration);
  assert.equal(billing.status, "complimentary");
  assert.equal(billing.allowsDashboard, true);
});

test("wrong promo code is rejected without creating an account", async () => {
  const platformStore = memoryStore();
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "badpromo@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
    promoCode: "nope",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_promo");
  assert.equal(platformStore.users.length, 0);
});

test("Crete88 still grants complimentary when typed in lowercase", async () => {
  const platformStore = memoryStore();
  const result = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "lower@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
    promoCode: "crete88",
  });
  assert.equal(result.ok, true);
  assert.equal(result.complimentary, true);
});

test("retrying an unpaid signup with Crete88 upgrades the existing book", async () => {
  const platformStore = memoryStore();
  const first = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "retry@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
  });
  assert.equal(first.complimentary, false);
  const second = await provisionFeRetentionAccount({
    platformStore,
    hashPassword,
    verifyPassword,
    name: "Ada",
    email: "retry@agency.test",
    password: "password1",
    agencyName: "Ada Agency",
    promoCode: "Crete 88",
  });
  assert.equal(second.ok, true);
  assert.equal(second.resumed, true);
  assert.equal(second.businessId, first.businessId);
  assert.equal(second.complimentary, true);
  assert.equal(readFeRetentionBilling(platformStore.businesses[0].packageConfiguration).allowsDashboard, true);
});
