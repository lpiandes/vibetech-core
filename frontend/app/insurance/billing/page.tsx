import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { platformStore } from "@/lib/server/compose";
import { readFeRetentionBilling } from "../../../../backend/core/fe-retention/FeRetentionBilling.js";
import { resolveFeRetentionContinuePath } from "../../../../backend/core/fe-retention/FeRetentionOnboarding.js";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceBillingActions } from "@/components/insurance/InsuranceBillingActions";
import { insuranceBillingPath, withQuery } from "@/lib/platform/hosts";
import { insuranceSignInHref } from "@/lib/platform/routeProtection";
import { claimFeRetentionPaidReturn } from "@/lib/insurance/claimFeRetentionPaidReturn";

export default async function InsuranceBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; paid?: string; canceled?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const requestedId = String(params.businessId ?? "").trim();
  const sessionId = String(params.session_id ?? "").trim();
  const paidFlag = String(params.paid ?? "").trim();
  const returnPath = withQuery(insuranceBillingPath(requestedId || null), {
    paid: paidFlag || undefined,
    session_id: sessionId || undefined,
    canceled: params.canceled === "1" ? "1" : undefined,
  });

  const access = await getFeRetentionAccess();
  if (!access.signedIn) {
    redirect(insuranceSignInHref(returnPath));
  }

  const businessId = requestedId
    || access.primaryBusinessId
    || access.businesses[0]?.id
    || "";

  if (businessId && sessionId) {
    await claimFeRetentionPaidReturn({ businessId, sessionId });
  }

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
  if (billing.allowsDashboard) {
    redirect(resolveFeRetentionContinuePath({
      businessId,
      packageConfiguration: business?.packageConfiguration,
    }));
  }

  const justPaid = paidFlag === "1" || Boolean(sessionId);
  const canceled = params.canceled === "1";

  return (
    <InsurancePublicShell
      title={justPaid ? "Confirming your payment" : "Catch up to continue"}
      lede={
        justPaid
          ? "If this page is still here, wait a moment and refresh — your dashboard unlocks when the subscription is active."
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
