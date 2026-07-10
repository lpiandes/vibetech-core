import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const result = await ctx.service.previewCampaignSend(workId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "Send preview failed." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.sendCampaignWork(
      workId,
      { binding: body.binding ?? null, actorId: String(ctx.user.id) },
      new Date().toISOString(),
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "Campaign send failed." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      workId: result.workId,
      deliverySummary: result.deliverySummary,
      deliveryRecords: result.deliveryRecords,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
