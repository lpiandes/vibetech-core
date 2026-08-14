import test from "node:test";
import assert from "node:assert/strict";

import {
  FE_RETENTION_MONTHLY_AMOUNT_CENTS,
  feRetentionDashboardAllowed,
  feRetentionNeedsPayment,
  readFeRetentionBilling,
  writeFeRetentionBilling,
  billingPatchFromStripeEvent,
  findFeRetentionBusinessForStripe,
  applyFeRetentionStripeEvent,
} from "./FeRetentionBilling.js";

test("dashboard unlocks only on active/trialing", () => {
  assert.equal(feRetentionDashboardAllowed("active"), true);
  assert.equal(feRetentionDashboardAllowed("trialing"), true);
  assert.equal(feRetentionDashboardAllowed("past_due"), false);
  assert.equal(feRetentionDashboardAllowed("incomplete"), false);
  assert.equal(feRetentionNeedsPayment("past_due"), true);
  assert.equal(feRetentionNeedsPayment("incomplete"), true);
  assert.equal(feRetentionNeedsPayment("active"), false);
});

test("books without a Stripe record stay open (pre-self-serve installs)", () => {
  const billing = readFeRetentionBilling({ purchasedPackages: ["fe_retention_crm"] });
  assert.equal(billing.status, "legacy");
  assert.equal(billing.allowsDashboard, true);
});

test("writeFeRetentionBilling stamps the CRM package and $200 contract", () => {
  assert.equal(FE_RETENTION_MONTHLY_AMOUNT_CENTS, 20000);
  const next = writeFeRetentionBilling({}, { status: "incomplete" });
  assert.deepEqual(next.purchasedPackages, ["fe_retention_crm"]);
  assert.equal(readFeRetentionBilling(next).status, "incomplete");
  assert.equal(readFeRetentionBilling(next).allowsDashboard, false);
});

test("billingPatchFromStripeEvent maps checkout and past_due invoice", () => {
  const checkout = billingPatchFromStripeEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "paid",
        customer: "cus_1",
        subscription: "sub_1",
        metadata: { businessId: "biz_1" },
      },
    },
  });
  assert.equal(checkout.status, "active");
  assert.equal(checkout.businessId, "biz_1");

  const failed = billingPatchFromStripeEvent({
    type: "invoice.payment_failed",
    data: {
      object: {
        customer: "cus_1",
        subscription: "sub_1",
        subscription_details: { metadata: { businessId: "biz_1" } },
      },
    },
  });
  assert.equal(failed.status, "past_due");
});

test("applyFeRetentionStripeEvent updates the matching book", async () => {
  const config = writeFeRetentionBilling({}, { status: "incomplete", stripeCustomerId: "cus_1" });
  const business = { id: "biz_1", packageConfiguration: config };
  const store = {
    async listBusinesses() { return [business]; },
    async updateBusinessPackageConfiguration({ packageConfiguration }) {
      business.packageConfiguration = packageConfiguration;
    },
    async getBusinessOSInstallation() { return null; },
  };
  const result = await applyFeRetentionStripeEvent({
    platformStore: store,
    event: {
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active", metadata: { businessId: "biz_1" } } },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(readFeRetentionBilling(business.packageConfiguration).allowsDashboard, true);
  assert.equal(
    findFeRetentionBusinessForStripe({ businesses: [business], stripeCustomerId: "cus_1" })?.id,
    "biz_1",
  );
});
