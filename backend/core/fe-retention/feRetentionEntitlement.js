import {
  normalizePurchasedPackages,
  readPurchasedPackagesFromConfig,
} from "../platform/packages/SalesPackageCatalog.js";
import { readFeRetentionBilling } from "./FeRetentionBilling.js";
import { readFeRetentionOnboarding } from "./FeRetentionOnboarding.js";

/** Present one FE book for pickers, paywall, and admin directory. */
export function presentFeRetentionBook(business) {
  const billing = readFeRetentionBilling(business?.packageConfiguration ?? {});
  return {
    id: business?.id != null ? String(business.id) : "",
    name: String(business?.name ?? "Agency"),
    billingStatus: billing.status,
    allowsDashboard: billing.allowsDashboard,
    needsPayment: billing.needsPayment,
    onboardingComplete: readFeRetentionOnboarding(business?.packageConfiguration ?? {}).onboardingComplete,
  };
}

export const FE_RETENTION_CRM_PACKAGE_ID = "fe_retention_crm";

export function isFeRetentionBusinessArchived(business) {
  return String(business?.status ?? "").toUpperCase() === "ARCHIVED";
}

/** FE books this user actually belongs to — never the admin global directory. */
export function listOwnedFeRetentionBooks(businesses = []) {
  const list = Array.isArray(businesses) ? businesses : [];
  return list.filter((business) =>
    businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {})),
  );
}

/** Live VibeKeep books only — archived signups do not keep a From-number or inbound route. */
export function listActiveFeRetentionBooks(businesses = []) {
  return listOwnedFeRetentionBooks(businesses).filter((business) => !isFeRetentionBusinessArchived(business));
}

/**
 * @param {string[]} purchasedPackages
 * @returns {boolean}
 */
export function businessGrantsFeRetentionAccess(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  return packages.includes(FE_RETENTION_CRM_PACKAGE_ID);
}

/**
 * True when purchased scope is FE Retention CRM only (no other OS SKUs).
 * @param {string[]} purchasedPackages
 */
export function isFeRetentionOnlyPurchasedScope(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length) return false;
  return packages.length === 1 && packages[0] === FE_RETENTION_CRM_PACKAGE_ID;
}

/**
 * @param {Array<{ packageConfiguration?: object }>} businesses
 */
export function isUserFeRetentionOnly(businesses = []) {
  const list = Array.isArray(businesses) ? businesses : [];
  if (!list.length) return false;
  return list.every((business) =>
    isFeRetentionOnlyPurchasedScope(readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {})),
  );
}

/**
 * First FE book for a user. Paid books win; otherwise the unpaid book (paywall).
 * @param {{ businesses?: Array<{ id?: string, packageConfiguration?: object }>, isPlatformAdmin?: boolean }} input
 */
export function resolveFeRetentionEntitlement({ businesses = [], isPlatformAdmin = false } = {}) {
  const list = Array.isArray(businesses) ? businesses : [];
  const feBooks = [];
  for (const business of list) {
    const purchasedPackages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (!businessGrantsFeRetentionAccess(purchasedPackages)) continue;
    const billing = readFeRetentionBilling(business?.packageConfiguration ?? {});
    feBooks.push({
      business,
      billing,
      businessId: business?.id != null ? String(business.id) : null,
    });
  }
  if (!feBooks.length) {
    return { entitled: false, businessId: null, billing: null, allowsDashboard: Boolean(isPlatformAdmin) };
  }
  const paid = feBooks.find((row) => row.billing.allowsDashboard);
  const chosen = paid || feBooks[0];
  return {
    entitled: true,
    businessId: chosen.businessId,
    billing: chosen.billing,
    allowsDashboard: Boolean(isPlatformAdmin) || chosen.billing.allowsDashboard,
  };
}

/**
 * Next path after /insurance (or app root for FE-only users).
 * Paid book → dashboard. Unpaid → catch-up. Admin → directory of every book.
 */
export function resolveFeRetentionNextPath({
  signedIn = false,
  isPlatformAdmin = false,
  books = [],
} = {}) {
  if (!signedIn) {
    return { kind: "gate", href: "/insurance" };
  }
  if (isPlatformAdmin) {
    return { kind: "admin_directory", href: "/admin/insurance" };
  }
  const list = Array.isArray(books) ? books.filter((row) => row?.id) : [];
  const paid = list.filter((row) => row.allowsDashboard);
  const unpaid = list.filter((row) => !row.allowsDashboard);
  if (paid.length === 1) {
    if (paid[0].onboardingComplete === false) {
      return { kind: "setup", href: `/insurance/setup/${paid[0].id}` };
    }
    return { kind: "dashboard", href: `/insurance/${paid[0].id}` };
  }
  if (paid.length > 1) {
    return { kind: "picker", href: "/insurance" };
  }
  if (unpaid.length) {
    return {
      kind: "billing",
      href: `/insurance/billing?businessId=${encodeURIComponent(unpaid[0].id)}`,
    };
  }
  return { kind: "no_book", href: "/insurance" };
}
