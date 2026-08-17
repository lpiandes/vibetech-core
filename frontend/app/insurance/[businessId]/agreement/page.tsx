import { redirect } from "next/navigation";
import { platformStore } from "@/lib/server/compose";
import {
  readFeRetentionOnboarding,
  resolveFeRetentionContinuePath,
  feRetentionAgreementPdfHref,
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
      <p className="fe-muted">Signed copy for this book. Name and address came from the A2P form; the name they typed is the signature.</p>
      <p style={{ margin: "0 0 1rem" }}>
        <a href={feRetentionAgreementPdfHref(businessId)} className="fe-muted" style={{ color: "inherit", fontWeight: 700 }}>
          Download signed PDF
        </a>
      </p>
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
    </div>
  );
}
