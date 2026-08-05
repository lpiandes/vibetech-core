import { Suspense } from "react";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import AdminVtPage from "@/components/admin/AdminVtPage";
import DeliveryMoatClient from "@/components/admin/DeliveryMoatClient";
import { VtDockLink } from "@/components/product/VtChrome";

/**
 * Plan 12 — delivery moat pattern candidates (PLATFORM_ADMIN only).
 */
export default async function AdminPatternsPage() {
  await requirePlatformAdmin();

  return (
    <AdminVtPage
      title="Delivery patterns"
      eyebrow="Catalog"
      statusLabel="Moat"
      statusTone="live"
      dock={(
        <>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
          <VtDockLink href="/admin/exceptions">Exceptions</VtDockLink>
          <VtDockLink href="/admin/blueprints">Blueprints</VtDockLink>
        </>
      )}
    >
      <Suspense fallback={<p>Loading pattern candidates…</p>}>
        <DeliveryMoatClient />
      </Suspense>
    </AdminVtPage>
  );
}
