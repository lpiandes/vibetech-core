import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; workId: string }> },
) {
  try {
    const { businessId, workId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId);
    const body = await request.json().catch(() => ({}));
    const result = await ctx.service.completeWorkItem({
      workItemId: workId,
      outcomeSummary: typeof body?.outcomeSummary === "string" ? body.outcomeSummary : "",
      memoryChanges: Array.isArray(body?.memoryChanges) ? body.memoryChanges : [],
      actorId: ctx.user?.id ?? "owner",
    });
    if (!result.ok) {
      const status = result.reason === "work_not_found" ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
