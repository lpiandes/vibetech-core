import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "../../../../../../../../backend/core/import/CrmImportOrchestrationService.js";
import { resolveImportDryRunContext } from "../../../../../../../../backend/core/import/resolveImportDryRunContext.js";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string; runId: string }> }) {
  try {
    const { businessId, runId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const { installationResult } = await resolveImportDryRunContext({
      workspaceId: businessId,
      activation: ctx.authz.activation,
    });

    const body = await request.json().catch(() => ({}));
    const result = await crmImportOrchestrationService.mapColumns({
      businessId,
      runId,
      profileId: body?.profileId,
      columnMapping: body?.columnMapping,
      installationResult,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return authorizationErrorResponse(err);
  }
}
