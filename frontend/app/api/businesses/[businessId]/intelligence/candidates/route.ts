import { NextResponse } from "next/server";
import {
  getAuthorizedBusinessScope,
  getAuthorizedWorkspace,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { workspaceCompositionRegistry } from "@/lib/workspace/WorkspaceCompositionRegistry";
import { projectIntelligenceCandidates } from "../../../../../../../backend/core/business-intelligence/candidates/IntelligenceCandidateProjection.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.BUSINESS_MANAGE);
    const connected = workspaceCompositionRegistry.get(businessId) as any;
    if (connected) {
      const stack = connected.operatingStack ?? connected.ctx;
      const projection = (projectIntelligenceCandidates as any)({
        intelligenceCandidateRuntime: stack?.intelligenceCandidateRuntime,
        businessId,
      });
      return NextResponse.json({ ok: true, ...projection });
    }
    // Cold isolate: do not boot workspace for a nav badge — return empty until Home warms.
    return NextResponse.json({ ok: true, openCount: 0, candidates: [] });
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
