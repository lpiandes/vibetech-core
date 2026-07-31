import type { ReactNode } from "react";
import { forbidden, notFound, redirect, unauthorized } from "next/navigation";
import { headers } from "next/headers";

import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";
import RememberBusinessCookie from "@/components/platform/RememberBusinessCookie";
import { AuthorizationError, platformStore } from "@/lib/server/compose";
import { composePortalModel } from "@/lib/portal-renderer/composePortalModel.js";
import { sanitizeCallbackUrl } from "@/lib/platform/routeProtection";
import { readPurchasedPackagesFromConfig, readPendingPackageAsk } from "../../../../backend/core/platform/packages/SalesPackageCatalog.js";

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
      if (err.code === "SUPPORT_ACCESS_REQUIRED") {
        forbidden();
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

  // Heal missing thin-SKU employees / wiped pending Ask from prior package-save bugs.
  if (purchasedPackages.length) {
    try {
      const { healPurchasedPackagesForBusiness } = await import(
        "../../../../backend/core/platform/packages/syncPurchasedPackagesOntoInstallation.js"
      );
      const heal = await healPurchasedPackagesForBusiness({
        platformStore,
        businessId,
        packageConfiguration,
        actorId: "layout_heal",
      });
      if (heal?.pendingRestored && heal.pendingPackageAsk) {
        packageConfiguration = {
          ...packageConfiguration,
          pendingPackageAsk: heal.pendingPackageAsk,
        };
        pendingPackageAsk = heal.pendingPackageAsk as typeof pendingPackageAsk;
      } else if (!pendingPackageAsk && heal?.pendingPackageAsk) {
        pendingPackageAsk = heal.pendingPackageAsk as typeof pendingPackageAsk;
      }
    } catch {
      // Non-fatal — page still renders.
    }
  }

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const onArchitect = /\/b\/[^/]+\/architect/.test(pathname);
  // Force package Ask only from Home (or bare /b/{id}) — never yank the owner off
  // Integrations / Settings mid-connect (that produced white-screen soft navs).
  const onHomeSurface = /\/b\/[^/]+\/?(?:home)?\/?$/.test(pathname)
    || /\/b\/[^/]+\/home(?:\/|$|\?)/.test(pathname);
  if (pendingPackageAsk && !onArchitect && onHomeSurface) {
    redirect(`/b/${encodeURIComponent(businessId)}/architect?packageAsk=1`);
  }

  let installedNavigation = null as any;
  let installedBusinessOS = null as any;
  try {
    const installation = await platformStore.getBusinessOSInstallation(businessId);
    let specification = null;
    if (installation?.specificationId) {
      try {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification = specRow?.specification ?? null;
      } catch {
        specification = null;
      }
    }

    if (installation?.configuration || specification) {
      const portalModel = composePortalModel({
        businessId,
        role: String(ctx.role),
        permissions,
        configuration: installation?.configuration ?? null,
        specification,
      } as any);
      installedBusinessOS = portalModel as any;
      installedNavigation = {
        modules: portalModel.modules,
        navigation: portalModel.navigation,
        roles: portalModel.roles,
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
