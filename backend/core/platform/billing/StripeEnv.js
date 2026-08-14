/**
 * Stripe env flags — no Node builtins, safe for client catalog helpers.
 */
export function isStripeBillingConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY ?? "").trim());
}

export function stripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY ?? "").trim();
}

export function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
}
