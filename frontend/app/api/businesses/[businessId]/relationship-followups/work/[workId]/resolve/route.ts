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
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const result = await ctx.service.resolveRelationshipFollowUpWork(
      {
        workId,
        outcomeId: String(body?.outcomeId ?? ""),
        note: body?.note === undefined ? undefined : String(body.note),
        nextFollowUpAt: body?.nextFollowUpAt === undefined || body?.nextFollowUpAt === null ? undefined : String(body.nextFollowUpAt),
        qualificationUpdates: body?.qualificationUpdates,
        actorId: String(ctx.user.id),
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      const status = result.reason === "work_not_found" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.errors?.[0] ?? result.reason, code: result.reason, errors: result.errors ?? [] }, { status });
    }

    return NextResponse.json({
      ok: true,
      workId: result.workId,
      interactionId: result.interactionId,
      outcomeId: result.outcomeId,
      idempotent: Boolean(result.idempotent),
      warnings: result.warnings ?? [],
      qualificationPatch: result.qualificationPatch ?? null,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
