import { NextResponse } from "next/server";

import { crmImportOrchestrationService } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string; runId: string }> }) {
  try {
    const { businessId, runId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const importRun = await crmImportOrchestrationService.getRun(businessId, runId);
    return NextResponse.json({ importRun });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
