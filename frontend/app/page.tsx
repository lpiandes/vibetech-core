import { cookies } from "next/headers";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

import { platformStore } from "@/lib/server/compose";
import { LAST_BUSINESS_COOKIE } from "@/lib/platform/businessCookies";
import { SOCIAL_CHECKER_HOST_URL, insuranceDashboardUrl, insuranceEntryUrl } from "@/lib/platform/hosts";
import { PLATFORM_ROLES } from "../../backend/core/platform/permissions/rolePermissions.js";
import { isUserSocialCheckerOnly } from "../../backend/core/platform/packages/socialCheckerEntitlement.js";
import {
  isUserFeRetentionOnly,
  businessGrantsFeRetentionAccess,
} from "../../backend/core/fe-retention/feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../../backend/core/platform/packages/SalesPackageCatalog.js";

/**
 * Intelligent product entry — Architect is primary when the product surface fits.
 * FE Retention-only agents go to insurance host; Social-only to Social Checker.
 */
export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdmin = session.user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const businesses = await platformStore.listBusinessesForUser(session.user.id);

  if (!isAdmin && isUserSocialCheckerOnly(businesses)) {
    redirect(SOCIAL_CHECKER_HOST_URL);
  }

  if (!isAdmin && isUserFeRetentionOnly(businesses)) {
    const fe = businesses.find((b: any) =>
      businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})),
    );
    if (fe?.id) {
      redirect(insuranceDashboardUrl(String(fe.id)));
    }
    redirect(insuranceEntryUrl());
  }

  const cookieStore = await cookies();
  const lastBusinessId = cookieStore.get(LAST_BUSINESS_COOKIE)?.value ?? null;

  if (lastBusinessId && businesses.some((row: any) => String(row.id) === String(lastBusinessId))) {
    const last = businesses.find((row: any) => String(row.id) === String(lastBusinessId));
    if (
      last
      && businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(last?.packageConfiguration ?? {}))
    ) {
      redirect(insuranceDashboardUrl(String(last.id)));
    }
    redirect(`/b/${lastBusinessId}/home`);
  }

  if (businesses.length === 1) {
    const only = businesses[0];
    if (businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(only?.packageConfiguration ?? {}))) {
      redirect(insuranceDashboardUrl(String(only.id)));
    }
    redirect(`/b/${only.id}/home`);
  }

  if (businesses.length > 1) {
    redirect("/businesses");
  }

  if (isAdmin) {
    redirect("/admin");
  }

  redirect("/architect");
}
