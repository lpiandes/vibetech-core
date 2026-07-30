import {
  normalizePurchasedPackages,
  readPurchasedPackagesFromConfig,
} from "./SalesPackageCatalog.js";

export const SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID = "social_background_screening";

/**
 * Social Checker is a separate paid SKU. Only businesses where admin explicitly
 * enabled `social_background_screening` get access — not full-OS legacy empty
 * packages, and not platform-admin by default.
 * @param {string[]} purchasedPackages
 * @returns {boolean}
 */
export function businessGrantsSocialCheckerAccess(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  return packages.includes(SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID);
}

/**
 * Resolve whether a signed-in user is entitled to Social Checker
 * (search + unblurred results + PDF).
 *
 * Entitled only when at least one of their businesses has
 * `social_background_screening` in purchasedPackages.
 *
 * @param {{ platformRole?: string|null, businesses?: Array<{ id?: string, packageConfiguration?: object }> }} input
 * @returns {{ entitled: boolean, reason: "social_package"|"none", businessId: string|null }}
 */
export function resolveSocialCheckerEntitlement({ platformRole = null, businesses = [] } = {}) {
  void platformRole;
  for (const business of Array.isArray(businesses) ? businesses : []) {
    const purchasedPackages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (!businessGrantsSocialCheckerAccess(purchasedPackages)) continue;
    return {
      entitled: true,
      reason: "social_package",
      businessId: business?.id != null ? String(business.id) : null,
    };
  }

  return { entitled: false, reason: "none", businessId: null };
}

/**
 * True when a business' purchased scope is Social Background Screening ONLY
 * (no other thin SKUs alongside it). Used to keep social-only customers on
 * the Social Checker host instead of the full Business OS shell.
 * @param {string[]} purchasedPackages
 * @returns {boolean}
 */
export function isSocialCheckerOnlyPurchasedScope(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length) return false;
  return packages.length === 1 && packages[0] === SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID;
}

/**
 * True when EVERY business a user belongs to is Social-Checker-only.
 * Zero businesses → not social-only (normal Architect / no-membership flow).
 * @param {Array<{ packageConfiguration?: object }>} businesses
 * @returns {boolean}
 */
export function isUserSocialCheckerOnly(businesses = []) {
  const list = Array.isArray(businesses) ? businesses : [];
  if (!list.length) return false;
  return list.every((business) =>
    isSocialCheckerOnlyPurchasedScope(readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {})),
  );
}
