import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const result = await ctx.service.getCampaignWork(workId);
    if (!result.ok) {
      const status = result.reason === "work_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.reason ?? "Campaign work not found." }, { status });
    }
    return NextResponse.json({
      ok: true,
      workId,
      campaign: result.campaign,
      document: result.document,
      sectionTypes: result.sectionTypes,
      expectedApprovalBinding: result.expectedApprovalBinding,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
