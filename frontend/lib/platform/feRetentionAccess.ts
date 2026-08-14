import { getSessionUser } from "./AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import {
  resolveFeRetentionEntitlement,
  isUserFeRetentionOnly,
  businessGrantsFeRetentionAccess,
  presentFeRetentionBook,
} from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { PLATFORM_ROLES } from "../../../backend/core/platform/permissions/rolePermissions.js";
import { insuranceDashboardPath } from "./hosts";

export type FeRetentionBook = {
  id: string;
  name: string;
  billingStatus: string;
  allowsDashboard: boolean;
  onboardingComplete?: boolean;
};

export type FeRetentionAccess = {
  signedIn: boolean;
  entitled: boolean;
  allowsDashboard: boolean;
  feOnly: boolean;
  isPlatformAdmin: boolean;
  displayName: string | null;
  businesses: FeRetentionBook[];
  primaryBusinessId: string | null;
  billingStatus: string | null;
};

function toBook(business: { id?: string; name?: string; packageConfiguration?: object }): FeRetentionBook {
  const presented = presentFeRetentionBook(business);
  return {
    id: presented.id,
    name: presented.name,
    billingStatus: presented.billingStatus,
    allowsDashboard: presented.allowsDashboard,
    onboardingComplete: presented.onboardingComplete,
  };
}

export async function getFeRetentionAccess(): Promise<FeRetentionAccess> {
  const user = await getSessionUser();
  if (!user) {
    return {
      signedIn: false,
      entitled: false,
      allowsDashboard: false,
      feOnly: false,
      isPlatformAdmin: false,
      displayName: null,
      businesses: [],
      primaryBusinessId: null,
      billingStatus: null,
    };
  }

  const isPlatformAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const memberships = await platformStore.listBusinessesForUser(user.id);
  let source = Array.isArray(memberships) ? memberships : [];
  if (isPlatformAdmin) {
    const all = await platformStore.listBusinesses({ limit: 500 }).catch(() => []);
    source = Array.isArray(all) ? all : source;
  }

  const feBusinesses = source
    .filter((b: { packageConfiguration?: object }) =>
      businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})),
    )
    .map(toBook);

  const entitlement = resolveFeRetentionEntitlement({
    businesses: source,
    isPlatformAdmin,
  });

  return {
    signedIn: true,
    entitled: entitlement.entitled || isPlatformAdmin,
    allowsDashboard: Boolean(entitlement.allowsDashboard),
    feOnly: isUserFeRetentionOnly(memberships),
    isPlatformAdmin,
    displayName: String((user as { name?: string }).name ?? user.email ?? "").trim() || null,
    businesses: feBusinesses,
    primaryBusinessId: entitlement.businessId,
    billingStatus: entitlement.billing?.status ?? null,
  };
}

export function feRetentionRedirectForBusiness(businessId: string) {
  return insuranceDashboardPath(businessId);
}
