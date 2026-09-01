import { NextResponse } from "next/server";
import { platformStore, AuthorizationError } from "@/lib/server/compose";
import { getAuthorizedBusinessScope, requireSessionUser } from "@/lib/platform/AuthorizedWorkspaceService";
import { feJsonError } from "@/lib/insurance/feRetentionApi";
import { getFeDeliveryProvider } from "@/lib/insurance/feRetentionApi";
import { PLATFORM_ROLES } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import { readFeRetentionBilling } from "../../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import {
  feA2pProfileIsComplete,
  normalizeFeA2pProfile,
  readFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
  writeFeRetentionOnboarding,
  VIBEKEEP_AGREEMENT_VERSION,
} from "../../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { buildFeRetentionEngagementAgreement } from "../../../../../../backend/core/fe-retention/FeRetentionEngagementAgreement.js";
import { ensureFeRetentionInstallation } from "../../../../../../backend/core/fe-retention/ensureFeRetentionInstallation.js";
import { notifyFeRetentionOnboardingComplete } from "../../../../../../backend/core/fe-retention/FeRetentionA2pOps.js";
import { submitFeRetentionA2pRegistration } from "../../../../../../backend/core/fe-retention/submitFeRetentionA2pRegistration.js";
import { agentNotifyFromOnboardingProfile } from "../../../../../../backend/core/fe-retention/FeRetentionAgentNotify.js";
import {
  readFeRetentionState,
  updateFeSettings,
  writeFeRetentionState,
} from "../../../../../../backend/core/fe-retention/FeRetentionStore.js";
import { putDurableCredential } from "../../../../../../backend/core/integrations/credentials/durableCredentialVault.js";
import { getSharedCredentialVault } from "@/lib/server/liveIntegrations";

async function requirePaidBook(businessId: string) {
  const user = await requireSessionUser();
  const isPlatformAdmin = user.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN;
  const business = await platformStore.getBusinessById(businessId);
  if (!business) throw new AuthorizationError("NOT_FOUND", "Business not found.");
  if (!isPlatformAdmin) {
    await getAuthorizedBusinessScope(businessId);
  }
  const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
  if (!isPlatformAdmin && !billing.allowsDashboard) {
    throw new AuthorizationError("PAYMENT_REQUIRED", "Pay first, then finish business details.");
  }
  return { user, business, isPlatformAdmin };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const { business } = await requirePaidBook(businessId);
    const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
    return NextResponse.json({
      ok: true,
      profile: onboarding.profile,
      profileComplete: onboarding.profileComplete,
      agreementComplete: onboarding.agreementComplete,
      next: resolveFeRetentionContinuePath({
        businessId,
        packageConfiguration: business.packageConfiguration,
      }),
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
    const { user, business } = await requirePaidBook(businessId);
    const body = await request.json().catch(() => ({}));
    const step = String(body.step || "");
    let nextConfig = business.packageConfiguration ?? {};

    if (step === "profile") {
      const profile = normalizeFeA2pProfile(body.profile || {});
      if (!feA2pProfileIsComplete(profile)) {
        return NextResponse.json({ ok: false, error: "Fill every required business field." }, { status: 400 });
      }
      nextConfig = writeFeRetentionOnboarding(nextConfig, { profile });
      await platformStore.updateBusinessPackageConfiguration({
        businessId,
        packageConfiguration: nextConfig,
      });
      return NextResponse.json({
        ok: true,
        next: resolveFeRetentionContinuePath({ businessId, packageConfiguration: nextConfig }),
      });
    }

    if (step === "agreement") {
      const current = readFeRetentionOnboarding(nextConfig);
      if (!current.profileComplete) {
        return NextResponse.json({ ok: false, error: "Save business details first." }, { status: 400 });
      }
      const signedName = String(body.signedName || "").trim();
      if (signedName.length < 3) {
        return NextResponse.json({ ok: false, error: "Type the owner’s full name to sign." }, { status: 400 });
      }
      const signedAt = new Date().toISOString();
      const doc = buildFeRetentionEngagementAgreement({
        profile: current.profile,
        signedName,
        signedAt,
      });
      nextConfig = writeFeRetentionOnboarding(nextConfig, {
        agreement: {
          signedName,
          signedAt,
          documentVersion: VIBEKEEP_AGREEMENT_VERSION,
        },
      });
      await platformStore.updateBusinessPackageConfiguration({
        businessId,
        packageConfiguration: nextConfig,
      });

      const ensured = await ensureFeRetentionInstallation({
        platformStore,
        businessId,
        packageConfiguration: nextConfig,
        actorId: user.id,
        putDurableCredential,
        vault: getSharedCredentialVault(),
        attachSms: true,
        light: false,
      });

      if (ensured.installation) {
        const notifySeed = agentNotifyFromOnboardingProfile(current.profile);
        const feState = readFeRetentionState(ensured.installation);
        const nextFeState = updateFeSettings(feState, {
          ...notifySeed,
          agentNotifyCustomized: false,
        });
        await writeFeRetentionState({
          platformStore,
          installation: ensured.installation,
          state: nextFeState,
          actorId: user.id,
          historyAction: "fe_agent_notify_seed",
        });
      }

      const a2pResult = await submitFeRetentionA2pRegistration({
        platformStore,
        businessId,
        profile: current.profile,
        fromNumber: ensured.sms?.fromNumber || null,
        businessName: String(business.name || current.profile.legalBusinessName),
        packageConfiguration: nextConfig,
        vault: getSharedCredentialVault(),
      });

      await notifyFeRetentionOnboardingComplete({
        businessId,
        businessName: String(business.name || current.profile.legalBusinessName),
        fromNumber: ensured.sms?.fromNumber || null,
        profile: current.profile,
        signedName,
        signedAt,
        agreementHtml: doc.html,
        agreementText: doc.text,
        a2pResult,
        deliveryProvider: getFeDeliveryProvider(),
      });

      return NextResponse.json({
        ok: true,
        fromNumber: ensured.sms?.fromNumber || null,
        a2pRegistrationStatus: a2pResult.a2pRegistrationStatus ?? "pending",
        a2pMessage: a2pResult.message ?? null,
        a2pError: a2pResult.error ?? null,
        next: `/insurance/${encodeURIComponent(businessId)}`,
      });
    }

    return NextResponse.json({ ok: false, error: "Unknown step." }, { status: 400 });
  } catch (err) {
    return feJsonError(err);
  }
}
