import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/compose";
import { createAndDeliverInvitation } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(_req: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_INVITE);
    const pending = await platformStore.listPendingInvitationsForBusiness(businessId);
    const members = await platformStore.listMembershipsForBusiness(businessId);
    return NextResponse.json({ pending, members });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_INVITE);
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const role = String(body?.role ?? "EMPLOYEE");
    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const invite = await createAndDeliverInvitation({
      businessId,
      email,
      role,
      invitedByUserId: ctx.user.id,
      inviterRole: ctx.authz.isPlatformAdmin ? "OWNER" : String(ctx.role),
      businessName: ctx.authz.business.name,
    });

    return NextResponse.json(
      {
        invitation: invite.invitation,
        inviteUrl: invite.inviteUrl,
        emailSent: invite.delivery.sent,
        deliveryMessage: invite.delivery.message,
      },
      { status: 201 },
    );
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
