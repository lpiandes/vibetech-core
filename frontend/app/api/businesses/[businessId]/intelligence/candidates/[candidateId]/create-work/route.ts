import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; candidateId: string }> },
) {
  try {
    const { businessId, candidateId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const result = await ctx.service.convertIntelligenceCandidateToWork(
      candidateId,
      body.nowISO ?? new Date().toISOString(),
    );
    if (!result.ok) {
      const status = result.reason === "candidate_not_found" ? 404 : 400;
      return NextResponse.json({
        ok: false,
        error: result.message ?? result.reason,
        code: result.reason,
      }, { status });
    }
    return NextResponse.json({
      ok: true,
      created: result.created,
      existing: result.existing,
      work: result.workItem
        ? {
            id: result.workItem.id,
            title: result.workItem.title,
            status: result.workItem.status,
          }
        : null,
      candidate: result.candidate,
      silentExternalCommunication: false,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
