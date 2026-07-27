import { NextResponse } from "next/server";

import {
  platformStore,
  buildInvitationUrl,
  validateInvitationForDisplay,
} from "@/lib/server/compose";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { MEMBERSHIP_ROLES } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

type Params = { params: Promise<{ businessId: string }> };

/**
 * Platform-admin recovery path for pending owner invites when email delivery
 * is not configured (or failed). Rebuilds the accept URL from the stored token.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePlatformAdminApi();
    const { businessId } = await params;
    const business = await platformStore.getBusinessById(businessId);
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const pending = await platformStore.listPendingInvitationsForBusiness(businessId);
    const invitation = pending.find(
      (invite: { role: string }) => invite.role === MEMBERSHIP_ROLES.OWNER,
    );
    if (!invitation) {
      return NextResponse.json({ error: "No pending owner invitation." }, { status: 404 });
    }

    const validation = validateInvitationForDisplay(invitation);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invitation is ${validation.reason}.` },
        { status: 409 },
      );
    }

    const token = await platformStore.getInvitationDeliveryToken(invitation.id);
    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is unavailable. Create a new invite." },
        { status: 409 },
      );
    }

    const inviteUrl = await buildInvitationUrl(token);
    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
      inviteUrl,
      emailConfigured: Boolean(String(process.env.RESEND_API_KEY ?? "").trim()),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
