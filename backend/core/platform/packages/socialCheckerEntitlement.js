import {
  isFullOsPurchasedScope,
  normalizePurchasedPackages,
  readPurchasedPackagesFromConfig,
} from "./SalesPackageCatalog.js";
import { PLATFORM_ROLES } from "../permissions/rolePermissions.js";

export const SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID = "social_background_screening";

/**
 * Does this single business' purchased-package scope grant Social Checker access?
 * True for full-OS scope (empty packages or any fullOs package) or the
 * dedicated Social Background Screening SKU.
 * @param {string[]} purchasedPackages
 * @returns {boolean}
 */
export function businessGrantsSocialCheckerAccess(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (isFullOsPurchasedScope(packages)) return true;
  return packages.includes(SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID);
}

/**
 * Resolve whether a signed-in user is entitled to the authenticated Social
 * Checker experience (unblurred results, PDF export).
 *
 * Entitled when any of:
 *  - platform admin
 *  - any of the user's businesses has full-OS purchased scope
 *  - any of the user's businesses purchased `social_background_screening`
 *
 * @param {{ platformRole?: string|null, businesses?: Array<{ id?: string, packageConfiguration?: object }> }} input
 * @returns {{ entitled: boolean, reason: "platform_admin"|"full_os"|"social_package"|"none", businessId: string|null }}
 */
export function resolveSocialCheckerEntitlement({ platformRole = null, businesses = [] } = {}) {
  if (platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
    return { entitled: true, reason: "platform_admin", businessId: null };
  }

  for (const business of Array.isArray(businesses) ? businesses : []) {
    const purchasedPackages = readPurchasedPackagesFromConfig(business?.packageConfiguration ?? {});
    if (!businessGrantsSocialCheckerAccess(purchasedPackages)) continue;
    return {
      entitled: true,
      reason: isFullOsPurchasedScope(purchasedPackages) ? "full_os" : "social_package",
      businessId: business?.id != null ? String(business.id) : null,
    };
  }

  return { entitled: false, reason: "none", businessId: null };
}

/**
 * True when a business' purchased scope is Social Background Screening ONLY
 * (not full OS, and no other thin SKU alongside it). Used to keep
 * social-only customers on the public Social Checker surface instead of
 * dropping them into the full Business OS shell.
 * @param {string[]} purchasedPackages
 * @returns {boolean}
 */
export function isSocialCheckerOnlyPurchasedScope(purchasedPackages = []) {
  const packages = normalizePurchasedPackages(purchasedPackages);
  if (!packages.length) return false;
  if (isFullOsPurchasedScope(packages)) return false;
  return packages.length === 1 && packages[0] === SOCIAL_BACKGROUND_SCREENING_PACKAGE_ID;
}

/**
 * True when EVERY business a user belongs to is Social-Checker-only, i.e.
 * the user has no reason to ever land in the full Business OS shell.
 * A user with zero businesses is not considered social-only (they should
 * see the normal Architect / no-membership flow).
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
