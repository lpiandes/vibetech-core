import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import AdminDeleteBusinessButton from "@/components/admin/AdminDeleteBusinessButton";
import StatusBadge from "@/components/product/StatusBadge";
import { VtDockLink } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

export default async function AdminBusinessesPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listBusinesses({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  const rows = (result.businesses ?? []).map((business: any) => [
    <strong key="n">{business.name}</strong>,
    business.industry ?? "—",
    <StatusBadge key="o" label={String(business.ownerStatus)} tone="neutral" />,
    business.installedOsVersion ?? "—",
    business.readiness ?? "—",
    <span key="a" style={{ display: "inline-flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Link href={`/admin/businesses/${business.id}`} style={{ color: cockpitColors.accent, fontWeight: 800 }}>
        Open
      </Link>
      <AdminDeleteBusinessButton businessId={business.id} businessName={String(business.name ?? "Business")} />
    </span>,
  ]);

  return (
    <AdminVtPage
      title="Businesses"
      dock={(
        <>
          <VtDockLink href="/platform">Create & invite</VtDockLink>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
        </>
      )}
    >
      <AdminDataTable
        title="Business directory"
        headers={["Name", "Industry", "Owner", "OS", "Readiness", "Actions"]}
        rows={rows}
        emptyLabel="No businesses yet."
      />
    </AdminVtPage>
  );
}
