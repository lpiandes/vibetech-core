/**
 * Operator release of a stuck VibeKeep signup: archive the book and free the
 * owner's email so they can create a new account. Does not delete history.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { PLATFORM_ROLES } from "../platform/permissions/rolePermissions.js";
import { businessGrantsFeRetentionAccess, isFeRetentionBusinessArchived } from "./feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../platform/packages/SalesPackageCatalog.js";

export function releasedVibeKeepEmail(userId, nowMs = Date.now()) {
  return `released.${String(userId)}.${Number(nowMs)}@invalid.local`;
}

export async function releaseFeRetentionSignup({ platformStore, businessId, nowMs = Date.now() } = {}) {
  const id = String(businessId ?? "").trim();
  if (!platformStore || !id) {
    return deepFreeze({ ok: false, reason: "missing_args", message: "Business id is required." });
  }

  const business = await platformStore.getBusinessById(id).catch(() => null);
  if (!business) {
    return deepFreeze({ ok: false, reason: "not_found", message: "Book not found." });
  }

  const packages = readPurchasedPackagesFromConfig(business.packageConfiguration ?? {});
  if (!businessGrantsFeRetentionAccess(packages)) {
    return deepFreeze({
      ok: false,
      reason: "not_vibekeep",
      message: "That business is not a VibeKeep book.",
    });
  }

  if (!isFeRetentionBusinessArchived(business)) {
    await platformStore.archiveBusiness({ businessId: id });
  }

  const memberships = await platformStore.listMembershipsForBusiness(id).catch(() => []);
  const releasedEmails = [];
  for (const row of Array.isArray(memberships) ? memberships : []) {
    const userId = row?.userId ? String(row.userId) : "";
    if (!userId) continue;
    const user = await platformStore.getUserById(userId).catch(() => null);
    if (!user) continue;
    if (user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) continue;

    const remaining = await platformStore.listBusinessesForUser(userId).catch(() => []);
    const stillActive = (Array.isArray(remaining) ? remaining : []).filter((rowBusiness) => (
      String(rowBusiness?.id) !== id && !isFeRetentionBusinessArchived(rowBusiness)
    ));
    if (stillActive.length) continue;

    const previousEmail = String(user.email ?? "");
    const nextEmail = releasedVibeKeepEmail(userId, nowMs);
    if (typeof platformStore.updateUserEmail !== "function") {
      return deepFreeze({
        ok: false,
        reason: "email_update_unavailable",
        message: "Cannot free that email on this store.",
      });
    }
    await platformStore.updateUserEmail(userId, nextEmail);
    releasedEmails.push({
      userId,
      from: previousEmail,
      to: nextEmail,
    });
  }

  return deepFreeze({
    ok: true,
    businessId: id,
    releasedEmails,
  });
}
