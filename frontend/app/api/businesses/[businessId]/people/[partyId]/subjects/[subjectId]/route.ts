import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

type Params = { params: Promise<{ businessId: string; partyId: string; subjectId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { businessId, partyId, subjectId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.unlinkPartyFromSubject(partyId, subjectId);
    return NextResponse.json({
      ok: true,
      relationshipId: result.relationshipId,
      duplicate: Boolean(result.duplicate),
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
