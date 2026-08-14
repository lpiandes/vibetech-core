import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { platformStore } from "@/lib/server/compose";
import { readFeRetentionBilling } from "../../../../../backend/core/fe-retention/FeRetentionBilling.js";
import {
  readFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
} from "../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceA2pOnboardingForm } from "@/components/insurance/InsuranceA2pOnboardingForm";
import { InsuranceSetupHelp } from "@/components/insurance/InsuranceSetupHelp";
import { insuranceBillingPath } from "@/lib/platform/hosts";

export default async function InsuranceA2pSetupPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect(`/insurance?callbackUrl=${encodeURIComponent(`/insurance/setup/${businessId}`)}`);
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
  if (onboarding.profileComplete) {
    redirect(resolveFeRetentionContinuePath({
      businessId,
      packageConfiguration: business.packageConfiguration,
    }));
  }

  return (
    <InsurancePublicShell
      wide
      title="Business details for texting"
      lede="Carriers require this to approve your agency’s texting number. You cannot open the dashboard until this and the agreement are done."
    >
      <InsuranceA2pOnboardingForm
        businessId={businessId}
        initial={{ ...onboarding.profile }}
      />
      <InsuranceSetupHelp />
    </InsurancePublicShell>
  );
}
