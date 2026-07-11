import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { accessRequestService } from "@/lib/platform/accessRequestService";
import { presentProductError } from "@/lib/platform/productErrors";
import { platformStore } from "../../../../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { applyAccessRequestMembershipGrant } from "../../../../../../../../backend/core/access-requests/applyAccessRequestMembershipGrant.js";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; accessRequestId: string }> },
) {
  try {
    const { businessId, accessRequestId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId);
    const body = await request.json().catch(() => ({}));
    const decisionRaw = String(body.decision ?? "").toLowerCase();
    const decision = decisionRaw === "approve" || decisionRaw === "approved"
      ? "approved"
      : decisionRaw === "reject" || decisionRaw === "rejected"
        ? "rejected"
        : null;
    if (!decision) {
      return NextResponse.json({
        ok: false,
        error: "Choose approve or reject.",
        productError: presentProductError("Choose approve or reject."),
      }, { status: 400 });
    }
    const result = await (accessRequestService as any).decide({
      businessId,
      accessRequestId,
      actorUserId: ctx.user.id,
      actorRole: ctx.authz.isPlatformAdmin ? "PLATFORM_ADMIN" : String(ctx.role),
      decision,
      notes: body.note ?? body.notes ?? null,
      membershipUpdater: async (grant: any) => {
        await applyAccessRequestMembershipGrant(platformStore, {
          ...grant,
          approverUserId: ctx.user.id,
        });
      },
    });
    if (!result?.ok) {
      return NextResponse.json({
        ok: false,
        error: presentProductError(result?.reason ?? "Could not update access request.").message,
        productError: presentProductError(result?.reason ?? "Could not update access request."),
      }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
