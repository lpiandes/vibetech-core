import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { platformStore } from "@/lib/server/compose";
import { readFeRetentionBilling } from "../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceBillingActions } from "@/components/insurance/InsuranceBillingActions";

export default async function InsuranceBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; paid?: string; canceled?: string }>;
}) {
  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect("/insurance");
  }

  const params = await searchParams;
  const requestedId = String(params.businessId ?? "").trim();
  const businessId = requestedId
    || access.primaryBusinessId
    || access.businesses[0]?.id
    || "";

  if (!businessId) {
    return (
      <InsurancePublicShell
        title="No book to bill"
        lede="Start a VibeKeep book, then complete the $200 monthly payment."
      >
        <Link href="/insurance/signup">Start VibeKeep →</Link>
      </InsurancePublicShell>
    );
  }

  const business = await platformStore.getBusinessById(businessId).catch(() => null);
  const billing = readFeRetentionBilling(business?.packageConfiguration ?? {});
  if (billing.allowsDashboard && params.paid === "1") {
    redirect(`/insurance/${businessId}`);
  }
  if (billing.allowsDashboard) {
    redirect(`/insurance/${businessId}`);
  }

  const justPaid = params.paid === "1";
  const canceled = params.canceled === "1";

  return (
    <InsurancePublicShell
      title={justPaid ? "Confirming your payment" : "Catch up to continue"}
      lede={
        justPaid
          ? "Stripe reported a successful checkout. If this page is still here, wait a moment and refresh — your dashboard unlocks when the subscription is active."
          : canceled
            ? "Checkout was canceled. Your book is paused until the $200 monthly subscription is current."
            : "This book is paused because the $200 monthly subscription is not current. Catch up on payment to open VibeKeep again."
      }
    >
      <p style={{ marginTop: 0, fontSize: 14, opacity: 0.85 }}>
        {business?.name ? String(business.name) : "Your agency"} · status: {billing.status}
      </p>
      <InsuranceBillingActions businessId={businessId} hasCustomer={Boolean(billing.stripeCustomerId)} />
      <p style={{ margin: "1rem 0 0", fontSize: 14 }}>
        <Link href="/insurance">Back to login</Link>
      </p>
    </InsurancePublicShell>
  );
}
