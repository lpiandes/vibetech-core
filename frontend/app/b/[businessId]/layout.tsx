import type { ReactNode } from "react";
import { forbidden, notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";
import RememberBusinessCookie from "@/components/platform/RememberBusinessCookie";
import { AuthorizationError, platformStore } from "@/lib/server/compose";
import { sanitizeCallbackUrl } from "@/lib/platform/routeProtection";
import { readPurchasedPackagesFromConfig, readPendingPackageAsk } from "../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getCachedInstalledPortal } from "@/lib/platform/cachedInstalledPortal";

export default async function BusinessScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  let ctx: Awaited<ReturnType<typeof getAuthorizedBusinessScope>>;
  try {
    ctx = await getAuthorizedBusinessScope(businessId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "UNAUTHENTICATED") {
        const headerStore = await headers();
        const pathname = headerStore.get("x-pathname") ?? `/b/${businessId}/home`;
        const search = headerStore.get("x-search") ?? "";
        const callbackUrl = sanitizeCallbackUrl(`${pathname}${search}`, `/b/${encodeURIComponent(businessId)}/home`);
        redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
      // Do not disclose business existence for non-members vs missing ids.
      if (err.code === "NOT_FOUND" || err.code === "FORBIDDEN") {
        notFound();
      }
      // Platform admins must enter support from Admin — send them back there
      // instead of Access denied → Go home (that looked like a broken twitch).
      if (err.code === "SUPPORT_ACCESS_REQUIRED") {
        redirect(`/admin/businesses/${encodeURIComponent(businessId)}?needSupport=1`);
      }
      forbidden();
    }
    throw err;
  }

  const permissions = Array.from(ctx.permissions).map(String);
  const businessName = ctx.authz.business.name;
  let packageConfiguration = ctx.authz.business.packageConfiguration ?? {};
  const purchasedPackages = readPurchasedPackagesFromConfig(packageConfiguration);
  let pendingPackageAsk = readPendingPackageAsk(packageConfiguration);

  // Heal only when a package Ask is pending — avoid DB work on every soft navigation.
  if (purchasedPackages.length && pendingPackageAsk) {
    try {
      const { healPurchasedPackagesForBusiness } = await import(
        "../../../../backend/core/platform/packages/syncPurchasedPackagesOntoInstallation.js"
      );
      await healPurchasedPackagesForBusiness({
        platformStore,
        businessId,
        packageConfiguration,
        actorId: "layout_heal",
        ensurePendingAsk: false,
      });
      pendingPackageAsk = readPendingPackageAsk(packageConfiguration);
    } catch {
      // Non-fatal — page still renders.
    }
  }

  let installedNavigation = null as any;
  let installedBusinessOS = null as any;
  try {
    const portal = await getCachedInstalledPortal(businessId, String(ctx.role), permissions);
    if (portal.portalModel) {
      installedBusinessOS = portal.portalModel as any;
      installedNavigation = {
        modules: portal.portalModel.modules,
        navigation: portal.portalModel.navigation,
        roles: portal.portalModel.roles,
      };
    }
  } catch {
    installedNavigation = null;
    installedBusinessOS = null;
  }

  return (
    <BusinessScopeProvider
      value={{
        businessId,
        role: String(ctx.role),
        permissions,
        businessName,
        purchasedPackages,
        pendingPackageAsk,
        installedNavigation,
        installedBusinessOS,
        supportAccess: ctx.authz.supportAccess ?? null,
      }}
    >
      <RememberBusinessCookie businessId={businessId} />
      <WorkspaceRenderer>{children}</WorkspaceRenderer>
    </BusinessScopeProvider>
  );
}
