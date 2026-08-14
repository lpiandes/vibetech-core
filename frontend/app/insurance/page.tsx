import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import { resolveFeRetentionNextPath } from "../../../backend/core/fe-retention/feRetentionEntitlement.js";
import { InsurancePublicShell } from "@/components/insurance/InsurancePublicShell";
import { InsuranceLoginForm } from "@/components/insurance/InsuranceLoginForm";
import { InsuranceBookList } from "@/components/insurance/InsuranceBookList";
import { sanitizeCallbackUrl } from "@/lib/platform/routeProtection";
import { VIBEKEEP_MONTHLY_PRICE_LABEL } from "@/lib/insurance/productBrand";

export default async function InsuranceIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const access = await getFeRetentionAccess();
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl, "/insurance");

  if (!access.signedIn) {
    return (
      <InsurancePublicShell
        showStory
        title="Log in"
        lede="Open your book. Reminders, birthdays, and lapse recovery are already running."
      >
        <InsuranceLoginForm callbackUrl={callbackUrl} />
        <p style={{ margin: "1.1rem 0 0", fontSize: 14, opacity: 0.9 }}>
          New agency?{" "}
          <Link href="/insurance/signup">Start VibeKeep · {VIBEKEEP_MONTHLY_PRICE_LABEL}</Link>
        </p>
      </InsurancePublicShell>
    );
  }

  if (access.isPlatformAdmin) {
    redirect("/admin/insurance");
  }

  const next = resolveFeRetentionNextPath({
    signedIn: true,
    isPlatformAdmin: false,
    books: access.businesses,
  });

  if (next.kind === "dashboard" || next.kind === "billing" || next.kind === "setup") {
    redirect(next.href);
  }

  if (next.kind === "picker") {
    return (
      <InsurancePublicShell title="Choose your book" lede="Pick which agency book to open.">
        <InsuranceBookList books={access.businesses.filter((b) => b.allowsDashboard)} />
      </InsurancePublicShell>
    );
  }

  return (
    <InsurancePublicShell
      title="No book on this login"
      lede="This email isn’t tied to a VibeKeep subscription. Start a new book, or log in with the email you used at checkout."
    >
      <p>
        <Link href="/insurance/signup">Start VibeKeep · {VIBEKEEP_MONTHLY_PRICE_LABEL} →</Link>
      </p>
    </InsurancePublicShell>
  );
}
