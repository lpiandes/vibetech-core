import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.prepareCampaign(
      {
        campaignTemplateId: body.campaignTemplateId ? String(body.campaignTemplateId) : undefined,
        businessTemplateId: body.businessTemplateId ? String(body.businessTemplateId) : null,
        subjectId: body.subjectId ? String(body.subjectId) : null,
        operationId: body.operationId ? String(body.operationId) : null,
        actorId: String(ctx.user.id),
      },
      new Date().toISOString(),
    );

    return NextResponse.json({
      ok: true,
      workId: result.workId,
      workHref: `/b/${encodeURIComponent(String(businessId))}/work?workId=${encodeURIComponent(String(result.workId))}`,
      threadId: result.threadId,
      messageId: result.messageId,
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
