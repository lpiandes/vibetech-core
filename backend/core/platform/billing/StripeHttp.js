/**
 * Stripe REST helper (Checkout + Billing Portal + webhook signatures).
 * Uses fetch + HMAC — no Stripe SDK. Same pattern as Twilio/Resend.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isStripeBillingConfigured, stripeSecretKey, stripeWebhookSecret } from "./StripeEnv.js";

export { isStripeBillingConfigured, stripeSecretKey, stripeWebhookSecret };

/**
 * Flatten nested objects/arrays into Stripe's form encoding:
 * line_items[0][price_data][currency]=usd
 */
export function flattenStripeParams(value, prefix = "") {
  const out = {};
  if (value == null || value === "") return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      Object.assign(out, flattenStripeParams(item, prefix ? `${prefix}[${index}]` : String(index)));
    });
    return out;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const next = prefix ? `${prefix}[${key}]` : key;
      Object.assign(out, flattenStripeParams(nested, next));
    }
    return out;
  }
  if (prefix) out[prefix] = String(value);
  return out;
}

async function stripeRequest(method, path, { body = null, fetchImpl = globalThis.fetch } = {}) {
  const secret = stripeSecretKey();
  if (!secret) {
    return deepFreeze({ ok: false, reason: "stripe_not_configured", status: 503 });
  }
  const headers = { Authorization: `Bearer ${secret}` };
  if (body != null) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetchImpl(`https://api.stripe.com/v1/${String(path).replace(/^\//, "")}`, {
    method,
    headers,
    body: body == null ? undefined : body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return deepFreeze({
      ok: false,
      reason: "stripe_api_error",
      status: res.status,
      message: String(data?.error?.message ?? "Stripe request failed."),
      code: data?.error?.code ?? null,
    });
  }
  return deepFreeze({ ok: true, data });
}

export async function stripeFormPost(path, params = {}, { fetchImpl = globalThis.fetch } = {}) {
  return stripeRequest("POST", path, {
    body: new URLSearchParams(flattenStripeParams(params)),
    fetchImpl,
  });
}

export async function stripeGet(path, { fetchImpl = globalThis.fetch } = {}) {
  return stripeRequest("GET", path, { fetchImpl });
}

/**
 * Verify `Stripe-Signature` per https://docs.stripe.com/webhooks/signatures
 */
export function verifyStripeWebhookSignature(rawBody, header, secret, { nowMs = Date.now(), toleranceSec = 300 } = {}) {
  const payload = typeof rawBody === "string" ? rawBody : String(rawBody ?? "");
  const sigHeader = String(header ?? "");
  const webhookSecret = String(secret ?? "").trim();
  if (!payload || !sigHeader || !webhookSecret) {
    return { ok: false, reason: "missing_signature_inputs" };
  }

  const parts = Object.create(null);
  for (const piece of sigHeader.split(",")) {
    const [k, v] = piece.split("=").map((s) => String(s).trim());
    if (k && v) {
      if (!parts[k]) parts[k] = [];
      parts[k].push(v);
    }
  }
  const timestamp = Number(parts.t?.[0]);
  const signatures = parts.v1 ?? [];
  if (!Number.isFinite(timestamp) || !signatures.length) {
    return { ok: false, reason: "malformed_signature_header" };
  }
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSec) {
    return { ok: false, reason: "timestamp_expired" };
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const matched = signatures.some((sig) => {
    const got = Buffer.from(String(sig), "utf8");
    return got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf);
  });
  return matched ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
