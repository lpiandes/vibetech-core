import type { ReactNode } from "react";

import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";
import RememberBusinessCookie from "@/components/platform/RememberBusinessCookie";
import { platformStore } from "../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { composePortalModel } from "@/lib/portal-renderer/composePortalModel.js";

export default async function BusinessScopedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const ctx = await getAuthorizedBusinessScope(businessId);
  const permissions = Array.from(ctx.permissions).map(String);
  const businessName = ctx.authz.business.name;

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
