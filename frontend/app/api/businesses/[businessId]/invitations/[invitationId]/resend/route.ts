import { NextResponse } from "next/server";

import { resendPendingInvitation } from "../../../../../../../../backend/core/platform/services/InvitationService.js";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> },
) {
  try {
    const { businessId, invitationId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_INVITE);
    const result = await resendPendingInvitation({
      businessId,
      invitationId,
      actorUserId: ctx.user.id,
    });

    return NextResponse.json({
      invitation: result.invitation,
      inviteUrl: result.inviteUrl,
      emailSent: result.delivery.sent,
      deliveryMessage: result.delivery.message,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
