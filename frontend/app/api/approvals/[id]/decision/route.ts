import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await context.params;
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision;
    const businessId = String(body?.businessId ?? "");
    if (!businessId) {
      return NextResponse.json({ ok: false, error: "businessId required" }, { status: 400 });
    }
    if (decision !== "GRANT" && decision !== "REJECT" && decision !== "APPROVE") {
      return NextResponse.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }

    const { service } = await getAuthorizedWorkspace(businessId);
    const result = service.applyOwnerApprovalDecision(resolvedParams.id, decision);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
