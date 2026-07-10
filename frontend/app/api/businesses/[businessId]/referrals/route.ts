import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = await request.json().catch(() => ({}));
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.recordReferralIntroduction({
      referrerPartyId: String(body.referrerPartyId ?? ""),
      introducedPartyId: body.introducedPartyId ? String(body.introducedPartyId) : null,
      introducedDisplayName: body.introducedDisplayName ? String(body.introducedDisplayName) : null,
      sourceInteractionId: body.sourceInteractionId ? String(body.sourceInteractionId) : null,
    });
    return NextResponse.json(result);
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_VIEW);
    return NextResponse.json({ ok: true, summary: ctx.service.loadReferralOperationsSummary() });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
