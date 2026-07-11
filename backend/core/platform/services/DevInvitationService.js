import { MEMBERSHIP_ROLE_LABELS } from "../permissions/rolePermissions.js";
import { recordDevInvitation, listDevInvitationLinks } from "./DevInvitationMailbox.js";
import { buildInvitationUrl } from "./InvitationService.js";
import { isTestEmail } from "../platformTestData.js";

function invitationStatus(invitation) {
  if (invitation.revokedAt) return "Revoked";
  if (invitation.acceptedAt) return "Accepted";
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return "Expired";
  return "Pending";
}

/**
 * @param {{ store: object, createAndDeliverInvitation?: Function }} deps
 */
export function createDevInvitationService({ store, createAndDeliverInvitation = null }) {
  if (!store) throw new Error("createDevInvitationService requires a platform store");

  async function listDevelopmentInvitations({ includeTestData = false } = {}) {
    const pending = await store.listAllPendingInvitations();
    const links = listDevInvitationLinks();

    return pending
      .filter((invitation) => includeTestData || !isTestEmail(invitation.email))
      .map((invitation) => ({
        id: invitation.id,
        businessId: invitation.businessId,
        businessName: invitation.businessName,
        email: invitation.email,
        role: invitation.role,
        roleLabel: MEMBERSHIP_ROLE_LABELS[invitation.role] ?? invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitationStatus(invitation),
        inviteUrl: links[invitation.id]?.inviteUrl ?? null,
        hasLink: Boolean(links[invitation.id]?.inviteUrl),
        createdAt: invitation.createdAt,
      }));
  }

  async function generateDevelopmentInvitationLink({ invitationId, actorUserId }) {
    const existing = await store.getInvitationById(invitationId);
    if (!existing) {
      throw new Error("INVITATION_NOT_FOUND");
    }
    if (existing.acceptedAt) {
      throw new Error("INVITATION_ALREADY_ACCEPTED");
    }
    if (existing.revokedAt) {
      throw new Error("INVITATION_REVOKED");
    }
    if (new Date(existing.expiresAt).getTime() < Date.now()) {
      throw new Error("INVITATION_EXPIRED");
    }

    const business = await store.getBusinessById(existing.businessId);
    const { invitation, token } = await store.createInvitation({
      businessId: existing.businessId,
      email: existing.email,
      role: existing.role,
      invitedByUserId: actorUserId,
    });

    const inviteUrl = await buildInvitationUrl(token);
    recordDevInvitation({
      invitationId: invitation.id,
      businessId: invitation.businessId,
      email: invitation.email,
      businessName: business?.name ?? "Business",
      inviteUrl,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });

    await store.recordAuditEvent({
      actorUserId,
      businessId: invitation.businessId,
      action: "invitation.dev_link_generated",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    return {
      invitation,
      inviteUrl,
      roleLabel: MEMBERSHIP_ROLE_LABELS[invitation.role] ?? invitation.role,
      businessName: business?.name ?? "Business",
    };
  }

  return {
    listDevelopmentInvitations,
    generateDevelopmentInvitationLink,
    createAndDeliverInvitation,
  };
}
