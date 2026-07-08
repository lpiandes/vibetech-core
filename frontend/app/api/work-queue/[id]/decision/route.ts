import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await context.params;
    const body = await req.json().catch(() => ({}));
    const businessId = String(body?.businessId ?? "");
    const decision = body?.decision;
    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId is required." }, { status: 400 });
    }
    if (decision !== "APPROVE" && decision !== "REJECT") {
      return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }

    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    await ctx.service.applyReviewDecision(resolvedParams.id, decision);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
