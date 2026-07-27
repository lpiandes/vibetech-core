import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutIntent,
  entitlementsFromSubscription,
  presentBillingStatus,
  presentManagedTierEntitlements,
} from "./StripeBillingScaffold.js";

test("checkout refuses when Stripe is not configured", () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  const intent = buildCheckoutIntent({ businessId: "biz", packageIds: ["ai_receptionist"] });
  assert.equal(intent.ok, false);
  assert.equal(intent.reason, "stripe_not_configured");
  if (prev != null) process.env.STRIPE_SECRET_KEY = prev;
});

test("billing status reports admin entitlements source", () => {
  const status = presentBillingStatus({ businessId: "biz", purchasedPackages: ["ai_receptionist"] });
  assert.match(String(status.entitlementsSource), /packageConfiguration/);
  assert.deepEqual(status.purchasedPackages, ["ai_receptionist"]);
});

test("entitlementsFromSubscription maps package ids when active", () => {
  const active = entitlementsFromSubscription({
    status: "active",
    packageIds: ["essential_managed", "addon_priority_support"],
  });
  assert.equal(active.ok, true);
  assert.ok(active.purchasedPackages.includes("essential_managed"));

  const canceled = entitlementsFromSubscription({
    status: "canceled",
    packageIds: ["essential_managed"],
  });
  assert.equal(canceled.ok, false);
  assert.deepEqual(canceled.purchasedPackages, []);
});

test("applySubscriptionEntitlementsToConfig writes purchasedPackages", async () => {
  const { applySubscriptionEntitlementsToConfig } = await import("./StripeBillingScaffold.js");
  const applied = applySubscriptionEntitlementsToConfig({
    packageConfiguration: { foo: 1 },
    status: "active",
    packageIds: ["ai_receptionist"],
  });
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.purchasedPackages, ["ai_receptionist"]);
  assert.equal(applied.packageConfiguration.foo, 1);
  assert.ok(applied.packageConfiguration.billingEntitlements);
});

test("professional managed tier presents caps and priority flag", () => {
  const tier = presentManagedTierEntitlements("professional_managed");
  assert.equal(tier.maxWorkers, 25);
  assert.equal(tier.prioritySupport, true);
  assert.equal(tier.sellable, false);
});

test("enterprise managed marks dedicated advisor", () => {
  const tier = presentManagedTierEntitlements("enterprise_managed");
  assert.equal(tier.dedicatedAdvisor, true);
});
