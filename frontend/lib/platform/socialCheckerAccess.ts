import { getSessionUser } from "./AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import {
  resolveSocialCheckerEntitlement,
  isUserSocialCheckerOnly,
  businessGrantsSocialCheckerAccess,
} from "../../../backend/core/platform/packages/socialCheckerEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";

export type SocialCheckerAccess = {
  signedIn: boolean;
  entitled: boolean;
  /** True when every business the user belongs to is Social Checker-only (never full OS). */
  socialOnly: boolean;
  reason: "social_package" | "none" | "signed_out";
  displayName: string | null;
  organizationName: string | null;
  organizationCode: string | null;
  businessId: string | null;
};

/**
 * Server-only helper resolving whether the current session is entitled to
 * the authenticated Social Checker experience (unblurred results, PDF
 * export), and whether the user should ever be routed into the full
 * Business OS shell.
 */
export async function getSocialCheckerAccess(): Promise<SocialCheckerAccess> {
  const user = await getSessionUser();
  if (!user) {
    return {
      signedIn: false,
      entitled: false,
      socialOnly: false,
      reason: "signed_out",
      displayName: null,
      organizationName: null,
      organizationCode: null,
      businessId: null,
    };
  }

  const businesses = await platformStore.listBusinessesForUser(user.id);
  const entitlement = resolveSocialCheckerEntitlement({
    platformRole: (user as { platformRole?: string | null }).platformRole ?? null,
    businesses,
  });

  const entitledBusiness = (Array.isArray(businesses) ? businesses : []).find((b) => {
    const pkgs = readPurchasedPackagesFromConfig
      ? readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})
      : [];
    return businessGrantsSocialCheckerAccess(pkgs);
  }) ?? (entitlement.businessId
    ? (Array.isArray(businesses) ? businesses : []).find((b) => String(b?.id) === entitlement.businessId)
    : null);

  const cfg = entitledBusiness?.packageConfiguration && typeof entitledBusiness.packageConfiguration === "object"
    ? entitledBusiness.packageConfiguration
    : {};

  return {
    signedIn: true,
    entitled: entitlement.entitled,
    socialOnly: isUserSocialCheckerOnly(businesses),
    reason: entitlement.reason,
    displayName: String((user as { name?: string }).name ?? user.email ?? "").trim() || null,
    organizationName: entitledBusiness?.name ? String(entitledBusiness.name) : null,
    organizationCode: cfg.organizationCode ? String(cfg.organizationCode) : null,
    businessId: entitlement.businessId,
  };
}
