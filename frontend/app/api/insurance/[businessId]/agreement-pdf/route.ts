import { NextResponse } from "next/server";
import { platformStore, AuthorizationError } from "@/lib/server/compose";
import { requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { requireFeRetentionContext, feJsonError } from "@/lib/insurance/feRetentionApi";
import { PLATFORM_ROLES } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { readFeRetentionOnboarding } from "../../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { renderFeRetentionEngagementAgreementPdf } from "../../../../../../backend/core/fe-retention/FeRetentionEngagementAgreementPdf.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const user = await requireSessionUser();
    let business;
    if (user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
      business = await platformStore.getBusinessById(businessId);
      if (!business) throw new AuthorizationError("NOT_FOUND", "Business not found.");
    } else {
      const ctx = await requireFeRetentionContext(businessId);
      business = ctx.business;
    }

    const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
    if (!onboarding.agreementComplete) {
      return NextResponse.json(
        { ok: false, error: "That book has not signed the engagement agreement yet." },
        { status: 409 },
      );
    }

    const pdf = await renderFeRetentionEngagementAgreementPdf({
      profile: onboarding.profile,
      signedName: onboarding.agreement?.signedName,
      signedAt: onboarding.agreement?.signedAt,
    });
    return new NextResponse(new Uint8Array(pdf.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return feJsonError(err);
  }
}
