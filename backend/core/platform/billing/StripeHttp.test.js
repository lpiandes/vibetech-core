import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  flattenStripeParams,
  verifyStripeWebhookSignature,
  isStripeBillingConfigured,
  stripeGet,
} from "./StripeHttp.js";

test("flattenStripeParams encodes nested checkout line items", () => {
  const flat = flattenStripeParams({
    mode: "subscription",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 20000 } }],
  });
  assert.equal(flat.mode, "subscription");
  assert.equal(flat["line_items[0][quantity]"], "1");
  assert.equal(flat["line_items[0][price_data][currency]"], "usd");
  assert.equal(flat["line_items[0][price_data][unit_amount]"], "20000");
});

test("verifyStripeWebhookSignature accepts a valid v1 HMAC", () => {
  const payload = '{"id":"evt_test"}';
  const secret = "whsec_test";
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex");
  const ok = verifyStripeWebhookSignature(payload, `t=${t},v1=${v1}`, secret);
  assert.equal(ok.ok, true);
});

test("verifyStripeWebhookSignature rejects a bad signature", () => {
  const payload = '{"id":"evt_test"}';
  const t = Math.floor(Date.now() / 1000);
  const bad = verifyStripeWebhookSignature(payload, `t=${t},v1=deadbeef`, "whsec_test");
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "signature_mismatch");
});

test("isStripeBillingConfigured reads STRIPE_SECRET_KEY", () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(isStripeBillingConfigured(), false);
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  assert.equal(isStripeBillingConfigured(), true);
  if (prev != null) process.env.STRIPE_SECRET_KEY = prev;
  else delete process.env.STRIPE_SECRET_KEY;
});

test("stripeGet retrieves a Stripe object", async () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  try {
    const result = await stripeGet("checkout/sessions/cs_test_1", {
      fetchImpl: async (url, init) => {
        assert.equal(String(url).includes("checkout/sessions/cs_test_1"), true);
        assert.equal(init.method, "GET");
        return { ok: true, json: async () => ({ id: "cs_test_1", payment_status: "paid" }) };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.data.id, "cs_test_1");
  } finally {
    if (prev != null) process.env.STRIPE_SECRET_KEY = prev;
    else delete process.env.STRIPE_SECRET_KEY;
  }
});
