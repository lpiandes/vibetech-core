import { NextResponse } from "next/server";

import { platformStore } from "@/lib/server/platformStore";
import { validateInvitationForDisplay } from "../../../../../backend/core/platform/services/InvitationService.js";
import { MEMBERSHIP_ROLE_LABELS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token?.trim()) {
      return NextResponse.json({ valid: false, reason: "not_found", error: "Invitation token is missing." });
    }

    const invitation = await platformStore.getInvitationByToken(token);
    const validation = validateInvitationForDisplay(invitation);

    if (validation.reason === "accepted" && validation.invitation) {
      const business = await platformStore.getBusinessById(validation.invitation.businessId);
      return NextResponse.json({
        valid: false,
        reason: "accepted",
        email: validation.invitation.email,
        role: validation.invitation.role,
        roleLabel: MEMBERSHIP_ROLE_LABELS[validation.invitation.role as keyof typeof MEMBERSHIP_ROLE_LABELS] ?? validation.invitation.role,
        businessId: validation.invitation.businessId,
        businessName: business?.name ?? "Business",
      });
    }

    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        reason: validation.reason ?? "not_found",
        email: validation.invitation?.email ?? null,
        businessName: null,
      });
    }

    const business = await platformStore.getBusinessById(validation.invitation!.businessId);
    return NextResponse.json({
      valid: true,
      email: validation.invitation!.email,
      role: validation.invitation!.role,
      roleLabel: MEMBERSHIP_ROLE_LABELS[validation.invitation!.role as keyof typeof MEMBERSHIP_ROLE_LABELS] ?? validation.invitation!.role,
      businessId: validation.invitation!.businessId,
      businessName: business?.name ?? "Business",
      expiresAt: validation.invitation!.expiresAt,
    });
  } catch (err) {
    console.error("[invite-get]", err);
    return NextResponse.json(
      { valid: false, reason: "server_error", error: "Could not load this invitation." },
      { status: 500 },
    );
  }
}
