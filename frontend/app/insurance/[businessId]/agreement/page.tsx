import { redirect } from "next/navigation";
import { platformStore } from "@/lib/server/compose";
import {
  readFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
} from "../../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { buildFeRetentionEngagementAgreement } from "../../../../../backend/core/fe-retention/FeRetentionEngagementAgreement.js";

export default async function InsuranceSignedAgreementPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await platformStore.getBusinessById(businessId).catch(() => null);
  if (!business) redirect("/insurance");
  const onboarding = readFeRetentionOnboarding(business.packageConfiguration ?? {});
  if (!onboarding.onboardingComplete) {
    redirect(resolveFeRetentionContinuePath({
      businessId,
      packageConfiguration: business.packageConfiguration,
    }));
  }

  const doc = buildFeRetentionEngagementAgreement({
    profile: onboarding.profile,
    signedName: onboarding.agreement?.signedName,
    signedAt: onboarding.agreement?.signedAt,
  });

  return (
    <div className="fe-card">
      <h2 style={{ marginTop: 0 }}>Engagement agreement</h2>
      <p className="fe-muted">Signed copy for this book. VibeTech colors and wordmark are on the document.</p>
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
    </div>
  );
}
