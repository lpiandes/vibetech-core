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
import { insuranceBillingPath, insuranceSetupPath, withQuery } from "@/lib/platform/hosts";
import { insuranceSignInHref } from "@/lib/platform/routeProtection";
import { claimFeRetentionPaidReturn } from "@/lib/insurance/claimFeRetentionPaidReturn";

export default async function InsuranceA2pSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ paid?: string; session_id?: string }>;
}) {
  const { businessId } = await params;
  const query = await searchParams;
  const sessionId = String(query.session_id ?? "").trim();
  const paid = String(query.paid ?? "").trim();
  const returnPath = withQuery(insuranceSetupPath(businessId), {
    paid: paid || undefined,
    session_id: sessionId || undefined,
  });

  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect(insuranceSignInHref(returnPath));
  }

  if (sessionId) {
    await claimFeRetentionPaidReturn({ businessId, sessionId });
  }

  const business = await platformStore.getBusinessById(businessId).catch(() => null);
  if (!business) redirect("/insurance");
  const entitled = access.isPlatformAdmin
    || access.businesses.some((b) => b.id === businessId);
  if (!entitled) redirect("/insurance");
  const billing = readFeRetentionBilling(business.packageConfiguration ?? {});
  if (!access.isPlatformAdmin && !billing.allowsDashboard) {
    redirect(withQuery(insuranceBillingPath(businessId), {
      paid: paid || undefined,
      session_id: sessionId || undefined,
    }));
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
