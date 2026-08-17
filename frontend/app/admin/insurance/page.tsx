import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { listAllFeRetentionBooks } from "@/lib/platform/feRetentionAccess";
import AdminVtPage from "@/components/admin/AdminVtPage";
import { InsuranceBookList } from "@/components/insurance/InsuranceBookList";
import { AdminReleaseVibeKeepButton } from "@/components/admin/AdminReleaseVibeKeepButton";
import { VtDockLink } from "@/components/product/VtChrome";

/**
 * Platform-admin directory of every FE Retention book.
 * Opening a row uses the same /insurance/:id shell the client sees.
 */
export default async function AdminInsurancePage() {
  await requirePlatformAdmin();
  const books = await listAllFeRetentionBooks();

  return (
    <AdminVtPage
      title="VibeKeep books"
      eyebrow="Admin"
      statusLabel={`${books.length} books`}
      dock={(
        <>
          <VtDockLink href="/insurance">Client entry</VtDockLink>
          <VtDockLink href="/admin/businesses">All businesses</VtDockLink>
        </>
      )}
    >
      <p style={{ marginTop: 0, maxWidth: 640 }}>
        Self-serve $200/month product — not assigned from package checkboxes.
        Open a book to see the same dashboard the agent sees. Preview the
        {" "}
        <Link href="/admin/insurance/agreement-preview">engagement agreement</Link>
        {" "}
        they sign. Release signup if they got stuck and need to create the account again on the same email.
      </p>
      <InsuranceBookList
        books={books}
        emptyLabel="No VibeKeep signups yet."
        openLabel="Open as client"
        action={(book) => (
          <AdminReleaseVibeKeepButton businessId={book.id} businessName={book.name} />
        )}
      />
      <p style={{ marginTop: 24 }}>
        <Link href="/admin/insurance/agreement-preview">Preview engagement agreement</Link>
        {" · "}
        <Link href="/admin">Back to admin</Link>
      </p>
    </AdminVtPage>
  );
}
