import { NextResponse } from "next/server";

import { generateDevelopmentInvitationLink } from "@/lib/server/compose";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const admin = await requirePlatformAdminApi();
    const { invitationId } = await params;
    const result = await generateDevelopmentInvitationLink({
      invitationId,
      actorUserId: admin.id,
    });

    return NextResponse.json({
      invitation: {
        id: result.invitation.id,
        email: result.invitation.email,
        role: result.invitation.role,
        roleLabel: result.roleLabel,
        businessName: result.businessName,
        expiresAt: result.invitation.expiresAt,
        status: "Pending",
        inviteUrl: result.inviteUrl,
        hasLink: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "INVITATION_NOT_FOUND") {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }
    if (message === "INVITATION_ALREADY_ACCEPTED") {
      return NextResponse.json({ error: "Invitation already accepted." }, { status: 400 });
    }
    if (message === "INVITATION_REVOKED") {
      return NextResponse.json({ error: "Invitation is no longer available." }, { status: 400 });
    }
    if (message === "INVITATION_EXPIRED") {
      return NextResponse.json({ error: "Invitation has expired." }, { status: 400 });
    }
    return authorizationErrorResponse(err);
  }
}
