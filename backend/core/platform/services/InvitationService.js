import { canInviteRole } from "../permissions/rolePermissions.js";
import { AuthorizationError } from "../AuthorizationError.js";
import { composeInvitationEmail } from "../invitations/InvitationEmailComposer.js";
import { validateProductionInvitationAppUrl } from "../invitations/invitationAppUrl.js";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function shouldExposeInviteUrl(delivery) {
  // When email did not go out, return the link so an admin can share it manually
  // (including production, where Resend may be unset).
  if (!delivery?.sent) return Boolean(delivery?.inviteUrl);
  // Successful send: keep the raw invite token out of API responses.
  return false;
}

function resolveLocalOrigin() {
  const base = String(process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base;
}

function deliveryResponse(delivery) {
  return {
    sent: Boolean(delivery.sent),
    reason: delivery.reason,
    message: delivery.message ?? (delivery.sent ? "Invitation email sent." : "Invitation email was not sent."),
  };
}

export async function buildInvitationUrl(token) {
  if (!isProduction()) {
    return `/invite/${token}`;
  }
  const appUrl = validateProductionInvitationAppUrl();
  if (!appUrl.valid) {
    throw new Error(appUrl.reason ?? "invalid_app_url");
  }
  return `${appUrl.baseUrl}/invite/${token}`;
}

export function validateInvitationForDisplay(invitation) {
  if (!invitation) return { valid: false, reason: "not_found" };
  if (invitation.revokedAt) return { valid: false, reason: "revoked" };
  if (invitation.acceptedAt) return { valid: false, reason: "accepted", invitation };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true, invitation };
}

/**
 * Pure invitation business logic with injected store + delivery.
 * @param {{
 *   store: object,
 *   deliveryProvider: { send: Function },
 *   recordDevInvitation?: Function,
 * }} deps
 */
export function createInvitationService({ store, deliveryProvider, recordDevInvitation = null }) {
  if (!store || typeof store.createInvitation !== "function") {
    throw new Error("createInvitationService requires a platform store");
  }
  if (!deliveryProvider || typeof deliveryProvider.send !== "function") {
    throw new Error("createInvitationService requires a delivery provider");
  }

  async function loadInvitationContext(invitation) {
    const business = await store.getBusinessById(invitation.businessId);
    const inviter = invitation.invitedByUserId ? await store.getUserById(invitation.invitedByUserId) : null;
    return {
      businessName: business?.name ?? "Your business",
      inviterName: inviter?.name ?? null,
    };
  }

  async function deliverInvitationEmail({ invitation, token, businessName, inviterName = null }) {
    if (isProduction()) {
      const appUrl = validateProductionInvitationAppUrl();
      if (!appUrl.valid) {
        return {
          sent: false,
          reason: appUrl.reason ?? "invalid_app_url",
          message: appUrl.message ?? "Application URL is not configured for production invitations.",
          inviteUrl: null,
        };
      }
    }

    const inviteUrl = await buildInvitationUrl(token);
    const composed = composeInvitationEmail({
      businessName,
      inviterName,
      role: invitation.role,
      inviteUrl: isProduction() ? inviteUrl : `${resolveLocalOrigin()}${inviteUrl}`,
      expiresAt: invitation.expiresAt,
    });

    const result = await deliveryProvider.send({
      to: invitation.email,
      subject: composed.subject,
      html: composed.html,
      text: composed.text,
      businessName,
      role: invitation.role,
    });

    return { ...result, inviteUrl };
  }

  async function createAndDeliverInvitation({
    businessId,
    email,
    role,
    invitedByUserId,
    inviterRole = null,
    businessName,
  }) {
    if (inviterRole && !canInviteRole(inviterRole, role)) {
      throw new AuthorizationError("FORBIDDEN", "You cannot invite someone with that role.");
    }

    const existingMember = await store.getActiveMembershipByEmail(businessId, email);
    if (existingMember) {
      throw new AuthorizationError("CONFLICT", "This person is already on your team.");
    }

    const inviter = invitedByUserId ? await store.getUserById(invitedByUserId) : null;
    const { invitation, token } = await store.createInvitation({
      businessId,
      email,
      role,
      invitedByUserId,
    });

    await store.saveInvitationDeliveryToken(invitation.id, token);

    const delivery = await deliverInvitationEmail({
      invitation,
      token,
      businessName,
      inviterName: inviter?.name ?? null,
    });

    if (!isProduction() && delivery.inviteUrl && typeof recordDevInvitation === "function") {
      recordDevInvitation({
        invitationId: invitation.id,
        businessId,
        email,
        businessName,
        inviteUrl: delivery.inviteUrl,
        role,
        expiresAt: invitation.expiresAt,
      });
    }

    await store.recordAuditEvent({
      actorUserId: invitedByUserId,
      businessId,
      action: "invitation.created",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email, role, emailSent: delivery.sent, deliveryReason: delivery.reason },
    });

    return {
      invitation,
      inviteUrl: shouldExposeInviteUrl(delivery) ? delivery.inviteUrl : undefined,
      delivery: deliveryResponse(delivery),
    };
  }

  async function resendPendingInvitation({ businessId, invitationId, actorUserId }) {
    const invitation = await store.getInvitationById(invitationId);
    if (!invitation || invitation.businessId !== businessId) {
      throw new AuthorizationError("NOT_FOUND", "Invitation not found.");
    }

    const validation = validateInvitationForDisplay(invitation);
    if (!validation.valid) {
      if (validation.reason === "accepted") {
        throw new AuthorizationError("CONFLICT", "This invitation was already accepted.");
      }
      if (validation.reason === "revoked") {
        throw new AuthorizationError("CONFLICT", "This invitation is no longer available.");
      }
      if (validation.reason === "expired") {
        throw new AuthorizationError("CONFLICT", "This invitation has expired.");
      }
      throw new AuthorizationError("NOT_FOUND", "Invitation not found.");
    }

    const token = await store.getInvitationDeliveryToken(invitationId);
    if (!token) {
      throw new AuthorizationError("CONFLICT", "This invitation cannot be resent.");
    }

    const beforeCount = await store.listPendingInvitationsForBusiness(businessId);
    const { businessName, inviterName } = await loadInvitationContext(invitation);
    const delivery = await deliverInvitationEmail({
      invitation,
      token,
      businessName,
      inviterName,
    });

    const afterCount = await store.listPendingInvitationsForBusiness(businessId);
    if (afterCount.length !== beforeCount.length) {
      throw new Error("INVITATION_RESEND_CREATED_UNEXPECTED_INVITATION");
    }

    await store.recordAuditEvent({
      actorUserId,
      businessId,
      action: "invitation.resent",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role, emailSent: delivery.sent, deliveryReason: delivery.reason },
    });

    return {
      invitation,
      inviteUrl: shouldExposeInviteUrl(delivery) ? delivery.inviteUrl : undefined,
      delivery: deliveryResponse(delivery),
    };
  }

  return {
    buildInvitationUrl,
    validateInvitationForDisplay,
    createAndDeliverInvitation,
    resendPendingInvitation,
  };
}
