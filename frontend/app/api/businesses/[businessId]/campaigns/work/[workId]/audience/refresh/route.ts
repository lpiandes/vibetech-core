import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.refreshCampaignAudience(workId, new Date().toISOString());
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "Could not refresh audience." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      workId: result.workId,
      messageId: result.messageId,
      contentVersion: result.contentVersion,
      audienceFingerprint: result.audienceFingerprint,
      fingerprintChanged: Boolean(result.fingerprintChanged),
      approvalInvalidated: Boolean(result.approvalInvalidated),
      forkedFromApproved: Boolean(result.forkedFromApproved),
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
