import { NextResponse } from "next/server";

import {
  platformStore,
  buildInvitationUrl,
  validateInvitationForDisplay,
  resendPendingInvitation,
} from "@/lib/server/compose";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { MEMBERSHIP_ROLES } from "../../../../../../../backend/core/platform/permissions/rolePermissions.js";

type Params = { params: Promise<{ businessId: string }> };

async function loadPendingOwnerInvitation(businessId: string) {
  const business = await platformStore.getBusinessById(businessId);
  if (!business) {
    return { error: NextResponse.json({ error: "Business not found." }, { status: 404 }) };
  }

  const pending = await platformStore.listPendingInvitationsForBusiness(businessId);
  const invitation = pending.find(
    (invite: { role: string }) => invite.role === MEMBERSHIP_ROLES.OWNER,
  );
  if (!invitation) {
    return { error: NextResponse.json({ error: "No pending owner invitation." }, { status: 404 }) };
  }

  const validation = validateInvitationForDisplay(invitation);
  if (!validation.valid) {
    return {
      error: NextResponse.json(
        { error: `Invitation is ${validation.reason}.` },
        { status: 409 },
      ),
    };
  }

  return { business, invitation };
}

/**
 * Platform-admin recovery path for pending owner invites when email delivery
 * is not configured (or failed). Rebuilds the accept URL from the stored token.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requirePlatformAdminApi();
    const { businessId } = await params;
    const loaded = await loadPendingOwnerInvitation(businessId);
    if ("error" in loaded && loaded.error) return loaded.error;
    const { invitation } = loaded as { invitation: { id: string; email: string; expiresAt?: string } };

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

/**
 * Resend pending owner invite email (and return invite URL for clipboard).
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const admin = await requirePlatformAdminApi();
    const { businessId } = await params;
    const loaded = await loadPendingOwnerInvitation(businessId);
    if ("error" in loaded && loaded.error) return loaded.error;
    const { invitation } = loaded as { invitation: { id: string; email: string } };

    const result = await resendPendingInvitation({
      businessId,
      invitationId: invitation.id,
      actorUserId: admin.id,
    });

    let inviteUrl = result.inviteUrl ?? null;
    if (!inviteUrl) {
      const token = await platformStore.getInvitationDeliveryToken(invitation.id);
      if (token) inviteUrl = await buildInvitationUrl(token);
    }

    return NextResponse.json({
      invitation: {
        id: result.invitation?.id ?? invitation.id,
        email: result.invitation?.email ?? invitation.email,
      },
      inviteUrl,
      emailSent: result.delivery?.sent === true,
      deliveryMessage: result.delivery?.message ?? null,
      emailConfigured: Boolean(String(process.env.RESEND_API_KEY ?? "").trim()),
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
