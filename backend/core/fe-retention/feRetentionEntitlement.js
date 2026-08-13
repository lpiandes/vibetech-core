import {
  normalizePurchasedPackages,
  readPurchasedPackagesFromConfig,
} from "../platform/packages/SalesPackageCatalog.js";

export const FE_RETENTION_CRM_PACKAGE_ID = "fe_retention_crm";

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
 * First FE-entitled business for a user.
 * @param {{ businesses?: Array<{ id?: string, packageConfiguration?: object }> }} input
 */
export function resolveFeRetentionEntitlement({ businesses = [] } = {}) {
  for (const business of Array.isArray(businesses) ? businesses : []) {
    const purchasedPackages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (!businessGrantsFeRetentionAccess(purchasedPackages)) continue;
    return {
      entitled: true,
      businessId: business?.id != null ? String(business.id) : null,
    };
  }
  return { entitled: false, businessId: null };
}
