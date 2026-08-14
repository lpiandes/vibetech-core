/**
 * Final Expense Retention — $200/mo self-serve Stripe subscription.
 * Access is billing status, not an admin package checkbox.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { FE_RETENTION_CRM_PACKAGE_ID } from "./feRetentionEntitlement.js";
import { mergePurchasedPackagesIntoConfig } from "../platform/packages/SalesPackageCatalog.js";
import { stripeFormPost, isStripeBillingConfigured } from "../platform/billing/StripeHttp.js";
import { FE_RETENTION_PRODUCT_NAME } from "./productBrand.js";

export const FE_RETENTION_MONTHLY_AMOUNT_CENTS = 20000;
export const FE_RETENTION_BILLING_CURRENCY = "usd";
export { FE_RETENTION_PRODUCT_NAME };

/** Stripe subscription statuses that unlock the agent dashboard. */
export const FE_RETENTION_PAID_STATUSES = Object.freeze(["active", "trialing"]);

/** Statuses that show the catch-up payment screen (account exists, access paused). */
export const FE_RETENTION_PAST_DUE_STATUSES = Object.freeze([
  "past_due",
  "unpaid",
  "canceled",
  "incomplete_expired",
  "paused",
]);

export function isFeRetentionBillingConfigured() {
  return isStripeBillingConfigured();
}

export function feRetentionDashboardAllowed(status) {
  return FE_RETENTION_PAID_STATUSES.includes(String(status ?? "").toLowerCase());
}

export function feRetentionNeedsPayment(status) {
  const s = String(status ?? "").toLowerCase();
  if (!s || s === "incomplete") return true;
  return FE_RETENTION_PAST_DUE_STATUSES.includes(s);
}

export function readFeRetentionBilling(packageConfiguration = {}) {
  const raw = packageConfiguration?.feRetentionBilling;
  if (!raw || typeof raw !== "object") {
    return deepFreeze({
      status: "legacy",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      updatedAt: null,
      allowsDashboard: true,
      needsPayment: false,
    });
  }
  const status = String(raw.status ?? "").trim().toLowerCase() || "incomplete";
  return deepFreeze({
    status,
    stripeCustomerId: raw.stripeCustomerId ? String(raw.stripeCustomerId) : null,
    stripeSubscriptionId: raw.stripeSubscriptionId ? String(raw.stripeSubscriptionId) : null,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : null,
    allowsDashboard: feRetentionDashboardAllowed(status),
    needsPayment: feRetentionNeedsPayment(status),
  });
}

export function writeFeRetentionBilling(packageConfiguration = {}, patch = {}) {
  const prev = readFeRetentionBilling(packageConfiguration);
  const nextStatus = patch.status != null
    ? String(patch.status).toLowerCase()
    : (prev.status === "legacy" ? "incomplete" : prev.status);
  const withPackage = mergePurchasedPackagesIntoConfig(
    packageConfiguration && typeof packageConfiguration === "object" ? packageConfiguration : {},
    [FE_RETENTION_CRM_PACKAGE_ID],
  );
  return {
    ...withPackage,
    feRetentionBilling: {
      status: nextStatus,
      stripeCustomerId: patch.stripeCustomerId !== undefined
        ? (patch.stripeCustomerId ? String(patch.stripeCustomerId) : null)
        : prev.stripeCustomerId,
      stripeSubscriptionId: patch.stripeSubscriptionId !== undefined
        ? (patch.stripeSubscriptionId ? String(patch.stripeSubscriptionId) : null)
        : prev.stripeSubscriptionId,
      updatedAt: new Date().toISOString(),
    },
  };
}

function appOriginFromRequestUrl(requestUrl) {
  const env = String(process.env.APP_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  try {
    return new URL(requestUrl).origin;
  } catch {
    return "https://app.vtechdevelopment.com";
  }
}

function checkoutLineItems() {
  const priceId = String(process.env.STRIPE_PRICE_FE_RETENTION_CRM ?? "").trim();
  if (priceId) {
    return [{ price: priceId, quantity: 1 }];
  }
  return [{
    quantity: 1,
    price_data: {
      currency: FE_RETENTION_BILLING_CURRENCY,
      unit_amount: FE_RETENTION_MONTHLY_AMOUNT_CENTS,
      recurring: { interval: "month" },
      product_data: { name: FE_RETENTION_PRODUCT_NAME },
    },
  }];
}

export async function createFeRetentionCheckoutSession({
  businessId,
  email,
  stripeCustomerId = null,
  requestUrl,
} = {}) {
  if (!isStripeBillingConfigured()) {
    return deepFreeze({
      ok: false,
      reason: "stripe_not_configured",
      message: "Set STRIPE_SECRET_KEY on the server before clients can pay.",
    });
  }
  const origin = appOriginFromRequestUrl(requestUrl);
  const params = {
    mode: "subscription",
    success_url: `${origin}/insurance/billing?paid=1`,
    cancel_url: `${origin}/insurance/billing?canceled=1`,
    client_reference_id: String(businessId),
    metadata: {
      businessId: String(businessId),
      packageId: FE_RETENTION_CRM_PACKAGE_ID,
    },
    subscription_data: {
      metadata: {
        businessId: String(businessId),
        packageId: FE_RETENTION_CRM_PACKAGE_ID,
      },
    },
    line_items: checkoutLineItems(),
  };
  if (stripeCustomerId) params.customer = String(stripeCustomerId);
  else if (email) params.customer_email = String(email);

  const result = await stripeFormPost("checkout/sessions", params);
  if (!result.ok) return result;
  const url = result.data?.url;
  if (!url) {
    return deepFreeze({ ok: false, reason: "missing_checkout_url", message: "Stripe did not return a checkout URL." });
  }
  return deepFreeze({
    ok: true,
    url: String(url),
    sessionId: result.data?.id ?? null,
    customerId: result.data?.customer ?? stripeCustomerId ?? null,
  });
}

export async function createFeRetentionBillingPortalSession({
  stripeCustomerId,
  requestUrl,
} = {}) {
  if (!stripeCustomerId) {
    return deepFreeze({ ok: false, reason: "no_customer", message: "No Stripe customer on this book yet." });
  }
  const origin = appOriginFromRequestUrl(requestUrl);
  const result = await stripeFormPost("billing_portal/sessions", {
    customer: String(stripeCustomerId),
    return_url: `${origin}/insurance`,
  });
  if (!result.ok) return result;
  const url = result.data?.url;
  if (!url) {
    return deepFreeze({ ok: false, reason: "missing_portal_url", message: "Stripe did not return a billing portal URL." });
  }
  return deepFreeze({ ok: true, url: String(url) });
}

function subscriptionStatusFromStripe(status) {
  const s = String(status ?? "").toLowerCase();
  return s || "incomplete";
}

export function billingPatchFromStripeEvent(event) {
  const type = String(event?.type ?? "");
  const object = event?.data?.object ?? {};

  if (type === "checkout.session.completed") {
    const paid = object.payment_status === "paid" || object.status === "complete";
    return {
      businessId: object.metadata?.businessId || object.client_reference_id || null,
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.subscription ?? null,
      status: paid ? "active" : "incomplete",
    };
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
    return {
      businessId: object.metadata?.businessId || null,
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.id ?? null,
      status: subscriptionStatusFromStripe(object.status),
    };
  }

  if (type === "customer.subscription.deleted") {
    return {
      businessId: object.metadata?.businessId || null,
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.id ?? null,
      status: "canceled",
    };
  }

  if (type === "invoice.payment_failed") {
    return {
      businessId: object.subscription_details?.metadata?.businessId
        || object.lines?.data?.[0]?.metadata?.businessId
        || null,
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.subscription ?? null,
      status: "past_due",
    };
  }

  if (type === "invoice.paid" || type === "invoice.payment_succeeded") {
    return {
      businessId: object.subscription_details?.metadata?.businessId || null,
      stripeCustomerId: object.customer ?? null,
      stripeSubscriptionId: object.subscription ?? null,
      status: "active",
    };
  }

  return null;
}

export function findFeRetentionBusinessForStripe({ businesses = [], businessId = null, stripeCustomerId = null } = {}) {
  const list = Array.isArray(businesses) ? businesses : [];
  const id = businessId ? String(businessId) : "";
  if (id) {
    const hit = list.find((b) => String(b.id) === id);
    if (hit) return hit;
  }
  const customer = stripeCustomerId ? String(stripeCustomerId) : "";
  if (!customer) return null;
  return list.find((b) => readFeRetentionBilling(b.packageConfiguration).stripeCustomerId === customer) ?? null;
}

export async function applyFeRetentionStripeEvent({ platformStore, event } = {}) {
  const patch = billingPatchFromStripeEvent(event);
  if (!patch) {
    return deepFreeze({ ok: true, ignored: true, type: event?.type ?? null });
  }

  let businesses = [];
  try {
    businesses = await platformStore.listBusinesses({ limit: 500 });
  } catch {
    businesses = [];
  }
  const business = findFeRetentionBusinessForStripe({
    businesses,
    businessId: patch.businessId,
    stripeCustomerId: patch.stripeCustomerId,
  });
  if (!business) {
    return deepFreeze({
      ok: false,
      reason: "business_not_found",
      type: event?.type ?? null,
      businessId: patch.businessId,
    });
  }

  const nextConfig = writeFeRetentionBilling(business.packageConfiguration ?? {}, {
    status: patch.status,
    stripeCustomerId: patch.stripeCustomerId,
    stripeSubscriptionId: patch.stripeSubscriptionId,
  });
  await platformStore.updateBusinessPackageConfiguration({
    businessId: business.id,
    packageConfiguration: nextConfig,
  });

  const installation = await platformStore.getBusinessOSInstallation?.(business.id).catch(() => null);
  if (installation) {
    await platformStore.upsertBusinessOSInstallation({
      id: installation.id ?? `install_${business.id}`,
      businessId: business.id,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion ?? 1,
      specificationContentHash: installation.specificationContentHash ?? "fe-billing",
      planId: installation.planId ?? `plan_${business.id}`,
      status: installation.status ?? "ACTIVE",
      configuration: {
        ...(installation.configuration ?? {}),
        purchasedPackages: nextConfig.purchasedPackages,
        feRetentionBilling: nextConfig.feRetentionBilling,
      },
    });
  }

  return deepFreeze({
    ok: true,
    businessId: String(business.id),
    status: patch.status,
    type: event?.type ?? null,
  });
}
