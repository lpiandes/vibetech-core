/**
 * Stripe SaaS billing scaffolding (Phase 5).
 * Catalog stub only — no live charges until STRIPE_SECRET_KEY + webhook are configured.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  getSalesPackage,
  listSellableSalesPackagesForAdmin,
  normalizePurchasedPackages,
} from "../packages/SalesPackageCatalog.js";

export function isStripeBillingConfigured() {
  return Boolean(String(process.env.STRIPE_SECRET_KEY ?? "").trim());
}

/**
 * Map sellable package ids to Stripe price ids via env:
 * STRIPE_PRICE_<PACKAGE_ID_UPPER> e.g. STRIPE_PRICE_AI_RECEPTIONIST
 */
export function resolveStripePriceId(packageId) {
  const id = String(packageId ?? "").trim();
  if (!id) return null;
  const envKey = `STRIPE_PRICE_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const value = String(process.env[envKey] ?? "").trim();
  return value || null;
}

export function buildCheckoutIntent({
  businessId,
  packageIds = [],
  mode = "subscription",
} = {}) {
  if (!isStripeBillingConfigured()) {
    return deepFreeze({
      ok: false,
      reason: "stripe_not_configured",
      note: "Set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars before enabling checkout.",
    });
  }
  const lineItems = (Array.isArray(packageIds) ? packageIds : [])
    .map((packageId) => ({
      packageId,
      priceId: resolveStripePriceId(packageId),
    }))
    .filter((row) => row.priceId);
  if (!lineItems.length) {
    return deepFreeze({
      ok: false,
      reason: "no_priced_packages",
      note: "No STRIPE_PRICE_* mappings for the requested packages.",
    });
  }
  return deepFreeze({
    ok: true,
    mode,
    businessId: String(businessId ?? ""),
    lineItems,
    // Placeholder — real Stripe Checkout Session create happens when SDK is wired.
    nextStep: "create_checkout_session",
  });
}

/**
 * Map a Stripe subscription (or sandbox payload) → purchasedPackages entitlements.
 * Until webhooks land, admin checkboxes remain the source of truth.
 */
export function entitlementsFromSubscription({
  status = "active",
  priceIds = [],
  packageIds = [],
} = {}) {
  const normalizedStatus = String(status ?? "").toLowerCase();
  if (!["active", "trialing"].includes(normalizedStatus)) {
    return deepFreeze({
      ok: false,
      reason: "subscription_inactive",
      purchasedPackages: [],
    });
  }

  const fromPackages = normalizePurchasedPackages(packageIds);
  if (fromPackages.length) {
    return deepFreeze({
      ok: true,
      source: "subscription_package_ids",
      purchasedPackages: fromPackages,
    });
  }

  const sellable = listSellableSalesPackagesForAdmin();
  const priceSet = new Set((Array.isArray(priceIds) ? priceIds : []).map(String));
  const mapped = sellable
    .filter((pkg) => {
      const priceId = resolveStripePriceId(pkg.id);
      return priceId && priceSet.has(priceId);
    })
    .map((pkg) => pkg.id);

  return deepFreeze({
    ok: mapped.length > 0,
    reason: mapped.length ? undefined : "no_matching_prices",
    source: "subscription_price_ids",
    purchasedPackages: mapped,
  });
}

export function presentManagedTierEntitlements(packageId) {
  const pkg = getSalesPackage(packageId);
  if (!pkg) return null;
  return deepFreeze({
    packageId: pkg.id,
    label: pkg.label,
    commercialStatus: pkg.commercialStatus,
    sellable: pkg.sellable === true,
    maxWorkers: pkg.maxWorkers ?? null,
    maxWorkflows: pkg.maxWorkflows ?? null,
    prioritySupport: pkg.id === "addon_priority_support"
      || pkg.id === "professional_managed"
      || pkg.id === "enterprise_managed",
    dedicatedAdvisor: pkg.id === "enterprise_managed",
    note: pkg.honestyNote ?? null,
  });
}

export function presentBillingStatus({ businessId = null, purchasedPackages = [] } = {}) {
  const packages = Array.isArray(purchasedPackages) ? purchasedPackages.map(String) : [];
  const managed = packages
    .map((id) => presentManagedTierEntitlements(id))
    .filter(Boolean);
  return deepFreeze({
    configured: isStripeBillingConfigured(),
    businessId: businessId ? String(businessId) : null,
    purchasedPackages: packages,
    entitlementsSource: isStripeBillingConfigured()
      ? "stripe_when_webhook_wired_else_packageConfiguration"
      : "packageConfiguration.purchasedPackages",
    managedTiers: managed,
    addOns: packages.filter((id) => String(id).startsWith("addon_")),
    note: isStripeBillingConfigured()
      ? "Stripe keys present — optional Checkout. Entitlements default from onboarding packages; invoices may be sent outside the app."
      : "Packages assigned at onboarding. Usage meters shown in Settings. Invoices are sent separately.",
  });
}

/**
 * Apply a subscription event to packageConfiguration.purchasedPackages.
 * Used by Stripe webhook (and sandbox POST preview).
 */
export function applySubscriptionEntitlementsToConfig({
  packageConfiguration = {},
  status = "active",
  packageIds = [],
  priceIds = [],
} = {}) {
  const entitlements = entitlementsFromSubscription({ status, packageIds, priceIds });
  if (!entitlements.ok) {
    return deepFreeze({
      ok: false,
      reason: entitlements.reason,
      packageConfiguration,
      purchasedPackages: [],
    });
  }
  const next = {
    ...(packageConfiguration && typeof packageConfiguration === "object" ? packageConfiguration : {}),
    purchasedPackages: entitlements.purchasedPackages,
    billingEntitlements: {
      source: entitlements.source,
      updatedAt: new Date().toISOString(),
      status: String(status),
    },
  };
  return deepFreeze({
    ok: true,
    packageConfiguration: next,
    purchasedPackages: entitlements.purchasedPackages,
    source: entitlements.source,
  });
}
