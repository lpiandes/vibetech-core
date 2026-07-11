import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/platformStore";
import { removeDevInvitationLink } from "../../../../../../../backend/core/platform/services/DevInvitationMailbox.js";
import { PERMISSIONS } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> },
) {
  try {
    const { businessId, invitationId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_MANAGE);
    const revoked = await platformStore.revokeInvitation(invitationId);
    if (!revoked || revoked.businessId !== businessId) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    removeDevInvitationLink(invitationId);
    await platformStore.recordAuditEvent({
      actorUserId: ctx.user.id,
      businessId,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: invitationId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
