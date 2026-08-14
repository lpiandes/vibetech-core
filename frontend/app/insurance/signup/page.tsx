import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceSignupForm } from "@/components/insurance/InsuranceSignupForm";
import { VIBEKEEP_MONTHLY_PRICE_LABEL } from "@/lib/insurance/productBrand";

export default async function InsuranceSignupPage() {
  const access = await getFeRetentionAccess();
  if (access.signedIn && access.allowsDashboard && access.primaryBusinessId) {
    const book = access.businesses.find((b) => b.id === access.primaryBusinessId);
    if (book?.onboardingComplete === false) {
      redirect(`/insurance/setup/${access.primaryBusinessId}`);
    }
    redirect(`/insurance/${access.primaryBusinessId}`);
  }
  if (access.signedIn && access.entitled && !access.allowsDashboard) {
    redirect("/insurance/billing");
  }

  return (
    <InsurancePublicShell
      showStory
      title="Create your account"
      lede={`Then pay ${VIBEKEEP_MONTHLY_PRICE_LABEL} on Stripe. After payment you’ll enter business details for texting, sign the agreement, and open your dashboard.`}
    >
      <InsuranceSignupForm />
      <p style={{ margin: "1.1rem 0 0", fontSize: 14, opacity: 0.9 }}>
        Already have an account? <Link href="/insurance">Log in</Link>
      </p>
    </InsurancePublicShell>
  );
}
