import type { ReactNode } from "react";

import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";
import { platformStore } from "../../../../backend/core/platform/persistence/PostgresPlatformStore.js";

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

  let installedNavigation = null;
  try {
    const installation = await platformStore.getBusinessOSInstallation(businessId);
    if (installation?.configuration) {
      installedNavigation = {
        modules: installation.configuration.modules ?? [],
        navigation: installation.configuration.navigation ?? null,
        roles: installation.configuration.roles ?? installation.configuration.roleDefinitions ?? [],
      };
    }
  } catch {
    installedNavigation = null;
  }

  return (
    <BusinessScopeProvider
      value={{
        businessId,
        role: String(ctx.role),
        permissions,
        businessName,
        installedNavigation,
        supportAccess: ctx.authz.supportAccess ?? null,
      }}
    >
      <WorkspaceRenderer>{children}</WorkspaceRenderer>
    </BusinessScopeProvider>
  );
}
