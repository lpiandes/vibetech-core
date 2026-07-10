import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const template = await ctx.service.saveCampaignAsTemplate(workId, {
      name: body.name ? String(body.name) : undefined,
      templateId: body.templateId ? String(body.templateId) : null,
      actorId: String(ctx.user.id),
    });
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
