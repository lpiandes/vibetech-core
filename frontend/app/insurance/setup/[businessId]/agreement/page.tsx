import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { platformStore } from "@/lib/server/compose";
import { readFeRetentionBilling } from "../../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import {
  readFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
  feRetentionSetupPath,
} from "../../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { buildFeRetentionEngagementAgreement } from "../../../../../../backend/core/fe-retention/FeRetentionEngagementAgreement.js";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceEngagementAgreementForm } from "@/components/insurance/InsuranceEngagementAgreementForm";
import { InsuranceSetupHelp } from "@/components/insurance/InsuranceSetupHelp";
import { insuranceBillingPath } from "@/lib/platform/hosts";
import { insuranceSignInHref } from "@/lib/platform/routeProtection";

export default async function InsuranceAgreementPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect(insuranceSignInHref(`/insurance/setup/${businessId}/agreement`));
  }

  const business = await platformStore.getBusinessById(businessId).catch(() => null);
  if (!business) redirect("/insurance");
  const entitled = access.isPlatformAdmin
    || access.businesses.some((b) => b.id === businessId);
  if (!entitled) redirect("/insurance");
  const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
  if (!access.isPlatformAdmin && !billing.allowsDashboard) {
    redirect(insuranceBillingPath(businessId));
  }
  const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
  if (!onboarding.profileComplete) {
    redirect(feRetentionSetupPath(businessId));
  }
  if (onboarding.onboardingComplete) {
    redirect(resolveFeRetentionContinuePath({
      businessId,
      packageConfiguration: business.packageConfiguration,
    }));
  }

  const doc = buildFeRetentionEngagementAgreement({
    profile: onboarding.profile,
    signedName: "",
    signedAt: null,
  });
  const expectedSigner = [onboarding.profile.contactFirstName, onboarding.profile.contactLastName]
    .filter(Boolean)
    .join(" ");

  return (
    <InsurancePublicShell
      wide
      title="Engagement agreement"
      lede="This is the VibeKeep engagement agreement with VibeTech’s wordmark. Read it, then type the owner’s name. After you sign we buy your texting number, put it in Settings, and open the dashboard."
    >
      <InsuranceEngagementAgreementForm
        businessId={businessId}
        agreementHtml={doc.html}
        expectedSigner={expectedSigner}
      />
      <InsuranceSetupHelp />
    </InsurancePublicShell>
  );
}
