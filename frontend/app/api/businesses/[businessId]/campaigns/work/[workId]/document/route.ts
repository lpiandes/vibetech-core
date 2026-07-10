import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.updateCampaignDocument(
      workId,
      {
        subjectLine: body.subjectLine,
        previewText: body.previewText,
        sections: body.sections,
      },
      new Date().toISOString(),
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "Could not update campaign document." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      workId: result.workId,
      messageId: result.messageId,
      contentVersion: result.contentVersion,
      contentHash: result.contentHash,
      idempotent: Boolean(result.idempotent),
      forkedFromApproved: Boolean(result.forkedFromApproved),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
