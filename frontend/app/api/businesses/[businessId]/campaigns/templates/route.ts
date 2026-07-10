import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const result = await ctx.service.listCampaignTemplates();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
