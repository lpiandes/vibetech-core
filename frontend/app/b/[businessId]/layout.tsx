import type { ReactNode } from "react";

import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { BusinessScopeProvider } from "@/lib/platform/BusinessScopeContext";
import WorkspaceRenderer from "@/components/workspace/WorkspaceRenderer";

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

  return (
    <BusinessScopeProvider
      value={{
        businessId,
        role: String(ctx.role),
        permissions,
        businessName,
      }}
    >
      <WorkspaceRenderer>{children}</WorkspaceRenderer>
    </BusinessScopeProvider>
  );
}
