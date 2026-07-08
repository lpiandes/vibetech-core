import { NextResponse } from "next/server";

import { platformStore } from "../../../../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { generateDevelopmentInvitationLink } from "../../../../../../../../backend/core/platform/services/DevInvitationService.js";
import { getDevInvitationLink } from "../../../../../../../../backend/core/platform/services/DevInvitationMailbox.js";
import { PERMISSIONS } from "../../../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { businessId, invitationId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_INVITE);
    const invitation = await platformStore.getInvitationById(invitationId);
    if (!invitation || invitation.businessId !== businessId) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const existing = getDevInvitationLink(invitationId);
    if (existing) {
      return NextResponse.json({ inviteUrl: existing });
    }

    return NextResponse.json({ inviteUrl: null });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; invitationId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { businessId, invitationId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.TEAM_INVITE);
    const invitation = await platformStore.getInvitationById(invitationId);
    if (!invitation || invitation.businessId !== businessId) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    const result = await generateDevelopmentInvitationLink({
      invitationId,
      actorUserId: ctx.user.id,
    });

    return NextResponse.json({ inviteUrl: result.inviteUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "INVITATION_NOT_FOUND") {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    if (message === "INVITATION_ALREADY_ACCEPTED") {
      return NextResponse.json({ error: "This invitation was already accepted." }, { status: 400 });
    }
    if (message === "INVITATION_REVOKED") {
      return NextResponse.json({ error: "This invitation is no longer available." }, { status: 400 });
    }
    if (message === "INVITATION_EXPIRED") {
      return NextResponse.json({ error: "This invitation has expired." }, { status: 400 });
    }
    return authorizationErrorResponse(err);
  }
}
