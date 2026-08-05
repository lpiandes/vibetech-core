import { Suspense } from "react";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import AdminVtPage from "@/components/admin/AdminVtPage";
import OperatorExceptionsClient from "@/components/admin/OperatorExceptionsClient";
import { VtDockLink } from "@/components/product/VtChrome";

/**
 * Plan 8 — cross-client operator exceptions console (PLATFORM_ADMIN only).
 */
export default async function AdminExceptionsPage() {
  await requirePlatformAdmin();

  return (
    <AdminVtPage
      title="Operator exceptions"
      eyebrow="Operate"
      statusLabel="Hybrid service"
      statusTone="live"
      dock={(
        <>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
          <VtDockLink href="/admin/support">Support enter</VtDockLink>
          <VtDockLink href="/admin/businesses">Businesses</VtDockLink>
        </>
      )}
    >
      <Suspense fallback={<p>Loading operator queue…</p>}>
        <OperatorExceptionsClient />
      </Suspense>
    </AdminVtPage>
  );
}
