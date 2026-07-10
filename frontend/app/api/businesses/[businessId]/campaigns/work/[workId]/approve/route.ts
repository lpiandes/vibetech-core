import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.approveCampaignWork(workId, new Date().toISOString());
    if (!result.ok) {
      const status = result.reason === "work_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.reason ?? "Campaign approval failed." }, { status });
    }
    return NextResponse.json({
      ok: true,
      workId: result.workId,
      messageId: result.messageId,
      communicationStatus: "queued",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
