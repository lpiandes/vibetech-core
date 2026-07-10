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
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    const result = await ctx.service.previewCampaignWork(workId, body.partyId ? String(body.partyId) : null);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason ?? "Could not preview campaign." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      preview: result.preview,
      contentVersion: result.contentVersion,
      contentHash: result.contentHash,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
