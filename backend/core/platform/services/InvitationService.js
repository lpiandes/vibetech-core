import { platformStore } from "../persistence/PostgresPlatformStore.js";
import { recordDevInvitation } from "./DevInvitationMailbox.js";
import { canInviteRole } from "../permissions/rolePermissions.js";
import { AuthorizationError } from "../authorizeBusinessAccess.js";
import { composeInvitationEmail } from "../delivery/InvitationEmailComposer.js";
import { createInvitationDeliveryProvider } from "../delivery/createInvitationDeliveryProvider.js";
import { validateProductionInvitationAppUrl } from "../delivery/invitationAppUrl.js";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function shouldExposeInviteUrl(delivery) {
  return !isProduction() && !delivery.sent;
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

async function loadInvitationContext(invitation) {
  const business = await platformStore.getBusinessById(invitation.businessId);
  const inviter = invitation.invitedByUserId ? await platformStore.getUserById(invitation.invitedByUserId) : null;
  return {
    businessName: business?.name ?? "Your business",
    inviterName: inviter?.name ?? null,
  };
}

/**
 * @param {{
 *   invitation: import("../persistence/platformMappers.js").mapInvitationRow extends () => infer R ? R : never,
 *   token: string,
 *   businessName: string,
 *   inviterName?: string | null,
 * }} input
 */
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

  const provider = createInvitationDeliveryProvider();
  const result = await provider.send({
    to: invitation.email,
    subject: composed.subject,
    html: composed.html,
    text: composed.text,
    businessName,
    role: invitation.role,
  });

  return { ...result, inviteUrl };
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

/**
 * @param {{ businessId: string, email: string, role: string, invitedByUserId: string, inviterRole?: string | null, businessName: string }} input
 */
export async function createAndDeliverInvitation({
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

  const existingMember = await platformStore.getActiveMembershipByEmail(businessId, email);
  if (existingMember) {
    throw new AuthorizationError("CONFLICT", "This person is already on your team.");
  }

  const inviter = invitedByUserId ? await platformStore.getUserById(invitedByUserId) : null;
  const { invitation, token } = await platformStore.createInvitation({
    businessId,
    email,
    role,
    invitedByUserId,
  });

  await platformStore.saveInvitationDeliveryToken(invitation.id, token);

  const delivery = await deliverInvitationEmail({
    invitation,
    token,
    businessName,
    inviterName: inviter?.name ?? null,
  });

  if (!isProduction() && delivery.inviteUrl) {
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

  await platformStore.recordAuditEvent({
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

/**
 * Resend email for an existing pending invitation without creating a new record.
 */
export async function resendPendingInvitation({ businessId, invitationId, actorUserId }) {
  const invitation = await platformStore.getInvitationById(invitationId);
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

  const token = await platformStore.getInvitationDeliveryToken(invitationId);
  if (!token) {
    throw new AuthorizationError("CONFLICT", "This invitation cannot be resent.");
  }

  const beforeCount = await platformStore.listPendingInvitationsForBusiness(businessId);
  const { businessName, inviterName } = await loadInvitationContext(invitation);
  const delivery = await deliverInvitationEmail({
    invitation,
    token,
    businessName,
    inviterName,
  });

  const afterCount = await platformStore.listPendingInvitationsForBusiness(businessId);
  if (afterCount.length !== beforeCount.length) {
    throw new Error("INVITATION_RESEND_CREATED_UNEXPECTED_INVITATION");
  }

  await platformStore.recordAuditEvent({
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

export function validateInvitationForDisplay(invitation) {
  if (!invitation) return { valid: false, reason: "not_found" };
  if (invitation.revokedAt) return { valid: false, reason: "revoked" };
  if (invitation.acceptedAt) return { valid: false, reason: "accepted", invitation };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { valid: false, reason: "expired" };
  return { valid: true, invitation };
}
