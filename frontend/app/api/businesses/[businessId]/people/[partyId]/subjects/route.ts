import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

type Params = { params: Promise<{ businessId: string; partyId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { businessId, partyId } = await params;
    const body = await request.json().catch(() => ({}));
    const subjectId = String(body.subjectId ?? body.propertyId ?? "").trim();
    if (!subjectId) {
      return NextResponse.json(
        { error: "subjectId is required.", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.linkPartyToSubject(partyId, subjectId);
    return NextResponse.json({
      ok: true,
      relationshipId: result.relationshipId,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
