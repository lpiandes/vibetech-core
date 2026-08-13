import { getSessionUser } from "./AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import {
  resolveFeRetentionEntitlement,
  isUserFeRetentionOnly,
  businessGrantsFeRetentionAccess,
} from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { readPurchasedPackagesFromConfig } from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { insuranceDashboardPath } from "./hosts";

export type FeRetentionAccess = {
  signedIn: boolean;
  entitled: boolean;
  feOnly: boolean;
  displayName: string | null;
  businesses: Array<{ id: string; name: string }>;
  primaryBusinessId: string | null;
};

export async function getFeRetentionAccess(): Promise<FeRetentionAccess> {
  const user = await getSessionUser();
  if (!user) {
    return {
      signedIn: false,
      entitled: false,
      feOnly: false,
      displayName: null,
      businesses: [],
      primaryBusinessId: null,
    };
  }

  const all = await platformStore.listBusinessesForUser(user.id);
  const feBusinesses = (Array.isArray(all) ? all : [])
    .filter((b) => businessGrantsFeRetentionAccess(readPurchasedPackagesFromConfig(b?.packageConfiguration ?? {})))
    .map((b) => ({ id: String(b.id), name: String(b.name ?? "Agency") }));

  const entitlement = resolveFeRetentionEntitlement({ businesses: all });

  return {
    signedIn: true,
    entitled: entitlement.entitled,
    feOnly: isUserFeRetentionOnly(all),
    displayName: String((user as { name?: string }).name ?? user.email ?? "").trim() || null,
    businesses: feBusinesses,
    primaryBusinessId: entitlement.businessId,
  };
}

export function feRetentionRedirectForBusiness(businessId: string) {
  return insuranceDashboardPath(businessId);
}
