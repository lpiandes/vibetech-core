import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; candidateId: string }> },
) {
  try {
    const { businessId, candidateId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.BUSINESS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const reason = body.reason ?? body.dismissalReason;
    if (!reason) {
      return NextResponse.json({ ok: false, error: "dismissal reason required" }, { status: 400 });
    }
    const result = await ctx.service.dismissIntelligenceCandidate(
      candidateId,
      reason,
      body.nowISO ?? new Date().toISOString(),
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      candidate: result.candidate,
      silentExternalCommunication: false,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
