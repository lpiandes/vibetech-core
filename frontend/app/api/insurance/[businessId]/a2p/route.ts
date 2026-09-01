import { NextResponse } from "next/server";
import { platformStore } from "@/lib/server/compose";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";
import { feJsonError, requireFeRetentionContext } from "@/lib/insurance/feRetentionApi";
import { requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { PLATFORM_ROLES } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import {
  loadFeSmsCredential,
  refreshFeRetentionA2pRegistration,
  submitFeRetentionA2pRegistration,
} from "../../../../../../backend/core/fe-retention/submitFeRetentionA2pRegistration.js";
import { readFeRetentionOnboarding } from "../../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { describeSmsCarrierStatus } from "../../../../../../backend/core/integrations/sms/smsCarrierStatus.js";

function a2pPayload(meta: Record<string, unknown> | null | undefined, fromNumber: string | null) {
  const m = meta && typeof meta === "object" ? meta : {};
  const described = describeSmsCarrierStatus(m);
  return {
    fromNumber,
    a2pRegistrationStatus: m.a2pRegistrationStatus ?? "pending",
    brandRegistrationSid: m.brandRegistrationSid ?? null,
    campaignSid: m.campaignSid ?? null,
    messagingServiceSid: m.messagingServiceSid ?? null,
    customerProfileSid: m.customerProfileSid ?? null,
    a2pMessage: m.a2pMessage ?? null,
    a2pError: m.a2pError ?? null,
    a2pLastCheckedAt: m.a2pLastCheckedAt ?? null,
    twilioBrandStatus: m.twilioBrandStatus ?? null,
    campaignStatus: m.campaignStatus ?? null,
    phase: described.phase,
    copy: described.copy,
    deliveryLikely: described.deliveryLikely,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await requireFeRetentionContext(businessId);
    const cred = await loadFeSmsCredential(platformStore, businessId);
    return NextResponse.json({
      ok: true,
      ...a2pPayload(cred?.metadata, cred?.fromNumber ?? null),
    });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const body = await request.json().catch(() => ({}));
    const user = await requireSessionUser();
    const isPlatformAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
    const resubmit = body?.resubmit === true;

    if (resubmit && !isPlatformAdmin) {
      return NextResponse.json({ error: "Only platform admin can force A2P resubmit." }, { status: 403 });
    }

    const onboarding = readFeRetentionOnboarding(ctx.business.packageConfiguration ?? {});
    const cred = await loadFeSmsCredential(platformStore, businessId);
    const vault = getSharedCredentialVault();

    if (resubmit || !cred?.metadata?.brandRegistrationSid) {
      const submitted = await submitFeRetentionA2pRegistration({
        platformStore,
        businessId,
        profile: onboarding.profile,
        fromNumber: cred?.fromNumber ?? null,
        businessName: String(ctx.business.name ?? onboarding.profile?.legalBusinessName ?? ""),
        packageConfiguration: ctx.business.packageConfiguration,
        vault,
        resubmit,
      });
      return NextResponse.json({
        ok: submitted.ok !== false,
        ...a2pPayload(submitted.metadata, submitted.fromNumber ?? cred?.fromNumber ?? null),
        message: submitted.message,
      });
    }

    const refreshed = await refreshFeRetentionA2pRegistration({
      platformStore,
      businessId,
      vault,
    });
    return NextResponse.json({
      ok: refreshed.ok !== false,
      ...a2pPayload(refreshed.metadata, refreshed.fromNumber ?? cred?.fromNumber ?? null),
      message: refreshed.message,
    });
  } catch (err) {
    return feJsonError(err);
  }
}
