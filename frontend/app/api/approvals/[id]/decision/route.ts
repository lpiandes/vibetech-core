import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { canDecideOutboundApproval } from "../../../../../../backend/core/approvals/OutboundApprovalGate.js";

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

    const ctx = await getAuthorizedWorkspace(businessId);
    const role = String((ctx as { authz?: { membership?: { role?: string } } }).authz?.membership?.role ?? "");
    const canDecide = ctx.permissions.has(PERMISSIONS.APPROVALS_DECIDE)
      || ctx.permissions.has(PERMISSIONS.WORK_MANAGE)
      || canDecideOutboundApproval(role);
    if (!canDecide) {
      return NextResponse.json({ ok: false, error: "Not allowed to decide approvals" }, { status: 403 });
    }
    const result = ctx.service.applyOwnerApprovalDecision(resolvedParams.id, decision);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
