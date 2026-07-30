import { getSessionUser } from "./AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { resolveSocialCheckerEntitlement, isUserSocialCheckerOnly } from "../../../backend/core/platform/packages/socialCheckerEntitlement.js";

export type SocialCheckerAccess = {
  signedIn: boolean;
  entitled: boolean;
  /** True when every business the user belongs to is Social Checker-only (never full OS). */
  socialOnly: boolean;
  reason: "platform_admin" | "full_os" | "social_package" | "none" | "signed_out";
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
    return { signedIn: false, entitled: false, socialOnly: false, reason: "signed_out" };
  }

  const businesses = await platformStore.listBusinessesForUser(user.id);
  const entitlement = resolveSocialCheckerEntitlement({
    platformRole: (user as { platformRole?: string | null }).platformRole ?? null,
    businesses,
  });

  return {
    signedIn: true,
    entitled: entitlement.entitled,
    socialOnly: isUserSocialCheckerOnly(businesses),
    reason: entitlement.reason,
  };
}
