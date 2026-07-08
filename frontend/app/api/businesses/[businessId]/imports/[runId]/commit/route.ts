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
    const result = await crmImportOrchestrationService.commit({
      businessId,
      runId,
      stack,
      installationResult,
      userId: ctx.user.id,
      allowReviewCommit: Boolean(body?.allowReviewCommit),
    });

    return NextResponse.json({
      ...result,
      reportUrl: `/api/businesses/${businessId}/imports/${runId}/report`,
    });
  } catch (err) {
    if (err instanceof Error && "code" in err) {
      if (err.code === "INVALID_STATE") {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err.code === "NOT_FOUND") {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
    }
    return authorizationErrorResponse(err);
  }
}
