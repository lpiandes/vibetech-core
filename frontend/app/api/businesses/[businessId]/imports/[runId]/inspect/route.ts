import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "@/lib/server/compose";
import { resolveImportDryRunContext } from "../../../../../../../../backend/core/import/resolveImportDryRunContext.js";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(_req: Request, { params }: { params: Promise<{ businessId: string; runId: string }> }) {
  try {
    const { businessId, runId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const { installationResult } = await resolveImportDryRunContext({
      workspaceId: businessId,
      activation: ctx.authz.activation,
    });

    const result = await crmImportOrchestrationService.inspect({
      businessId,
      runId,
      installationResult,
    });

    return NextResponse.json(result);
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
