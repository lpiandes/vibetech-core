import { getSessionUser } from "./AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import {
  resolveFeRetentionEntitlement,
  resolveFeRetentionNextPath,
  isUserFeRetentionOnly,
  listOwnedFeRetentionBooks,
  presentFeRetentionBook,
} from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
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
  const owned = Array.isArray(memberships) ? memberships : [];
  const feBusinesses = listOwnedFeRetentionBooks(owned).map(toBook);

  const entitlement = resolveFeRetentionEntitlement({
    businesses: owned,
    isPlatformAdmin: false,
  });

  return {
    signedIn: true,
    entitled: entitlement.entitled,
    allowsDashboard: Boolean(entitlement.allowsDashboard),
    feOnly: isUserFeRetentionOnly(owned),
    isPlatformAdmin,
    displayName: String((user as { name?: string }).name ?? user.email ?? "").trim() || null,
    businesses: feBusinesses,
    primaryBusinessId: entitlement.businessId,
    billingStatus: entitlement.billing?.status ?? null,
  };
}

/** Admin directory of every VibeKeep book — not used for the agent's own login. */
export async function listAllFeRetentionBooks(): Promise<FeRetentionBook[]> {
  const all = await platformStore.listBusinesses({ limit: 500 }).catch(() => []);
  return listOwnedFeRetentionBooks(Array.isArray(all) ? all : []).map(toBook);
}

export { resolveFeRetentionNextPath };

export function feRetentionRedirectForBusiness(businessId: string) {
  return insuranceDashboardPath(businessId);
}
