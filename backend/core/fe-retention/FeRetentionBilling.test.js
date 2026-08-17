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
  applyFeRetentionPaidCheckoutSession,
} from "./FeRetentionBilling.js";

test("dashboard unlocks only on active/trialing/complimentary", () => {
  assert.equal(feRetentionDashboardAllowed("active"), true);
  assert.equal(feRetentionDashboardAllowed("trialing"), true);
  assert.equal(feRetentionDashboardAllowed("complimentary"), true);
  assert.equal(feRetentionDashboardAllowed("legacy"), true);
  assert.equal(feRetentionDashboardAllowed("past_due"), false);
  assert.equal(feRetentionDashboardAllowed("incomplete"), false);
  assert.equal(feRetentionNeedsPayment("past_due"), true);
  assert.equal(feRetentionNeedsPayment("incomplete"), true);
  assert.equal(feRetentionNeedsPayment("complimentary"), false);
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

test("writeFeRetentionBilling preserves the book Twilio number across Stripe status updates", () => {
  const withNumber = writeFeRetentionBilling({}, { status: "incomplete", twilioFromNumber: "+15550001111" });
  assert.equal(readFeRetentionBilling(withNumber).twilioFromNumber, "+15550001111");
  const paid = writeFeRetentionBilling(withNumber, { status: "active" });
  assert.equal(readFeRetentionBilling(paid).status, "active");
  assert.equal(readFeRetentionBilling(paid).twilioFromNumber, "+15550001111");
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

test("applyFeRetentionPaidCheckoutSession unlocks the matching book from the return URL", async () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const config = writeFeRetentionBilling({}, { status: "incomplete" });
  const business = { id: "biz_1", packageConfiguration: config };
  const store = {
    async listBusinesses() { return [business]; },
    async updateBusinessPackageConfiguration({ packageConfiguration }) {
      business.packageConfiguration = packageConfiguration;
    },
    async getBusinessOSInstallation() { return null; },
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      payment_status: "paid",
      status: "complete",
      customer: "cus_1",
      subscription: "sub_1",
      metadata: { businessId: "biz_1" },
      client_reference_id: "biz_1",
    }),
  });
  try {
    const result = await applyFeRetentionPaidCheckoutSession({
      platformStore: store,
      sessionId: "cs_test_1",
      expectedBusinessId: "biz_1",
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.equal(readFeRetentionBilling(business.packageConfiguration).allowsDashboard, true);
    const mismatch = await applyFeRetentionPaidCheckoutSession({
      platformStore: store,
      sessionId: "cs_test_1",
      expectedBusinessId: "biz_other",
      fetchImpl,
    });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.reason, "business_mismatch");
  } finally {
    if (prev != null) process.env.STRIPE_SECRET_KEY = prev;
    else delete process.env.STRIPE_SECRET_KEY;
  }
});
