import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.BUSINESS_MANAGE);
    const projection = ctx.service.loadIntelligenceCandidates();
    return NextResponse.json({ ok: true, ...projection });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.BUSINESS_MANAGE);
    const result = await ctx.service.evaluateIntelligenceCandidates(new Date().toISOString());
    return NextResponse.json({
      ok: true,
      candidates: result.candidates,
      observationCount: result.observations?.length ?? 0,
      insightCount: result.insights?.length ?? 0,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
