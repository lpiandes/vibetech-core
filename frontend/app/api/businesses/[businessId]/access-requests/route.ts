import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { accessRequestService } from "@/lib/platform/accessRequestService";
import { presentProductError } from "@/lib/platform/productErrors";

export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId);
    const open = await accessRequestService.store.listOpen(businessId);
    const mine = open.filter((entry: any) => String(entry.requesterUserId) === String(ctx.user.id));
    const forOwner = ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.authz.isPlatformAdmin ? open : mine;
    return NextResponse.json({ ok: true, requests: forOwner });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId);
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({
        ok: false,
        error: "Please explain why you need access.",
        productError: presentProductError("Please explain why you need access."),
      }, { status: 400 });
    }
    const result = await accessRequestService.requestAccess({
      businessId,
      requesterUserId: ctx.user.id,
      requestKind: String(body.requestKind ?? "module_access"),
      reason,
      requestedModuleId: body.requestedModuleId ?? null,
      requestedPermission: body.requestedPermission ?? null,
      requestedRoleId: body.requestedRoleId ?? null,
      riskLevel: body.riskLevel ?? "medium",
      approverUserId: "owner",
    });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: "An identical access request is already open.",
        productError: presentProductError(result.reason ?? "duplicate_open_request"),
        existing: result.existing,
      }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
