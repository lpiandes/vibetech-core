import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "../../../../../../../../backend/core/import/CrmImportOrchestrationService.js";
import { resolveImportDryRunContext } from "../../../../../../../../backend/core/import/resolveImportDryRunContext.js";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string; runId: string }> }) {
  try {
    const { businessId, runId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const { stack, installationResult } = await resolveImportDryRunContext({
      workspaceId: businessId,
      activation: ctx.authz.activation,
    });

    const body = await request.json().catch(() => ({}));
    const result = await crmImportOrchestrationService.dryRun({
      businessId,
      runId,
      stack,
      installationResult,
      rowLimit: body?.rowLimit ?? null,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && "code" in err) {
      if (err.code === "INVALID_STATE") {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
    }
    return authorizationErrorResponse(err);
  }
}
