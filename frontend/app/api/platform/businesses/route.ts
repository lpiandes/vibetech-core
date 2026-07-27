import { NextResponse } from "next/server";

import { createBusinessWithOwnerInvite } from "@/lib/server/compose";
import { platformStore } from "@/lib/server/compose";
import { isLikelyAutomatedTestBusiness } from "../../../../../backend/core/platform/platformTestData.js";
import { MEMBERSHIP_ROLES } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import { requirePlatformAdminApi } from "@/lib/platform/requirePlatformAdmin";
import { authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { normalizePurchasedPackages } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

async function ownerInviteEmail(businessId: string) {
  const pending = await platformStore.listPendingInvitationsForBusiness(businessId);
  const ownerInvite = pending.find((invite: { role: string; email: string }) => invite.role === MEMBERSHIP_ROLES.OWNER);
  return ownerInvite?.email ?? null;
}

export async function GET() {
  try {
    await requirePlatformAdminApi();
    const businesses = await platformStore.listBusinesses({ includeArchived: false });
    const rows = await Promise.all(
      businesses.map(async (b: { id: string; name: string; kind: string }) => {
        const inviteEmail = await ownerInviteEmail(b.id);
        return {
          ...b,
          ownerStatus: await platformStore.getBusinessOwnerStatus(b.id),
          ownerInviteEmail: inviteEmail,
        };
      }),
    );

    const visible = rows.filter(
      (business) =>
        !isLikelyAutomatedTestBusiness({
          name: business.name,
          ownerInviteEmail: business.ownerInviteEmail,
        }),
    );

    return NextResponse.json({ businesses: visible });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdminApi();
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const ownerEmail = String(body?.ownerEmail ?? "").trim().toLowerCase();
    const purchasedPackages = normalizePurchasedPackages(body?.purchasedPackages);
    if (!name || !ownerEmail) {
      return NextResponse.json({ error: "Business name and owner email are required." }, { status: 400 });
    }
    if (!purchasedPackages.length) {
      return NextResponse.json(
        { error: "Select at least one purchased package from the sales sheet." },
        { status: 400 },
      );
    }

    const result = await createBusinessWithOwnerInvite({
      name,
      ownerEmail,
      createdByUserId: admin.id,
      purchasedPackages,
    });

    return NextResponse.json(
      {
        business: result.business,
        invitation: {
          id: result.invitation.invitation.id,
          email: result.invitation.invitation.email,
          inviteUrl: result.invitation.inviteUrl ?? null,
          emailSent: result.invitation.delivery.sent,
          deliveryReason: result.invitation.delivery.reason ?? null,
          deliveryMessage: result.invitation.delivery.message ?? null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
