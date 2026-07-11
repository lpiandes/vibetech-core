import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(request: Request, { params }: { params: Promise<{ businessId: string; runId: string }> }) {
  try {
    const { businessId, runId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const status = url.searchParams.get("status");

    const report = await crmImportOrchestrationService.getReport({
      businessId,
      runId,
      page,
      pageSize,
      status: status || null,
    });

    return NextResponse.json(report);
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
