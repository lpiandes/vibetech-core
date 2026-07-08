import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; candidateId: string }> },
) {
  try {
    const { businessId, candidateId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.createRelationshipFollowUpWork(candidateId, new Date().toISOString());

    if (!result.ok) {
      const status = result.reason === "candidate_not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: result.message ?? result.reason ?? "Relationship follow-up work creation failed.", code: result.reason ?? "FAILED" },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      created: Boolean(result.created),
      existing: Boolean(result.existing),
      candidateId,
      work: result.workItem
        ? {
            id: result.workItem.id,
            title: result.workItem.title,
            workType: result.workItem.workType,
            status: result.workItem.status,
            assignedTo: result.workItem.assignedTo,
          }
        : null,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
