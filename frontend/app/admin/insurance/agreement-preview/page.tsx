import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { buildFeRetentionEngagementAgreement } from "../../../../../backend/core/fe-retention/FeRetentionEngagementAgreement.js";
import AdminVtPage from "@/components/admin/AdminVtPage";
import { VtDockLink } from "@/components/product/VtChrome";

const SAMPLE = {
  legalBusinessName: "Sample Agency LLC",
  street: "1 Main Street",
  city: "Danvers",
  region: "MA",
  postalCode: "01923",
};

export default async function AdminAgreementPreviewPage() {
  await requirePlatformAdmin();
  const doc = buildFeRetentionEngagementAgreement({
    profile: SAMPLE,
    signedName: "Sample Owner",
    signedAt: "2026-08-14T18:00:00.000Z",
  });

  return (
    <AdminVtPage
      title="VibeKeep agreement preview"
      eyebrow="Admin"
      dock={<VtDockLink href="/admin/insurance">Back to books</VtDockLink>}
    >
      <p style={{ maxWidth: 640 }}>
        This page is a <strong>sample</strong> with fake names so you can read the clauses.
        Agencies see the real document on their own screen after they fill business details —
        legal name and address are pulled from that form, then they type their name to sign.
        The finished signed PDF is on each book row at
        {" "}
        <Link href="/admin/insurance">VibeKeep books</Link>
        {" "}
        (Download PDF), and in the agency Settings page.
      </p>
      <div dangerouslySetInnerHTML={{ __html: doc.html }} />
    </AdminVtPage>
  );
}
