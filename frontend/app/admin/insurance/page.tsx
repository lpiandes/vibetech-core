import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getFeRetentionAccess } from "@/lib/platform/feRetentionAccess";
import AdminVtPage from "@/components/admin/AdminVtPage";
import { InsuranceBookList } from "@/components/insurance/InsuranceBookList";
import { VtDockLink } from "@/components/product/VtChrome";

/**
 * Platform-admin directory of every FE Retention book.
 * Opening a row uses the same /insurance/:id shell the client sees.
 */
export default async function AdminInsurancePage() {
  await requirePlatformAdmin();
  const access = await getFeRetentionAccess();

  return (
    <AdminVtPage
      title="VibeKeep books"
      eyebrow="Admin"
      statusLabel={`${access.businesses.length} books`}
      dock={(
        <>
          <VtDockLink href="/insurance">Client entry</VtDockLink>
          <VtDockLink href="/admin/businesses">All businesses</VtDockLink>
        </>
      )}
    >
      <p style={{ marginTop: 0, maxWidth: 640 }}>
        Self-serve $200/month product — not assigned from package checkboxes.
        Open a book to see the same dashboard the agent sees.
      </p>
      <InsuranceBookList
        books={access.businesses}
        emptyLabel="No VibeKeep signups yet."
        openLabel="Open as client"
      />
      <p style={{ marginTop: 24 }}>
        <Link href="/admin">Back to admin</Link>
      </p>
    </AdminVtPage>
  );
}
