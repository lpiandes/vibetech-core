import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

/** Readiness projection needs operating stack — warm registry reuses composition. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const readiness = await ctx.service.loadMcBrideReadiness();
    return NextResponse.json({ ok: true, readiness });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
