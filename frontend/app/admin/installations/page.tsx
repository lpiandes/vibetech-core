import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import StatusBadge from "@/components/product/StatusBadge";
import { VtDockLink } from "@/components/product/VtChrome";

export default async function AdminInstallationsPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listInstallations({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  const rows = (result.installations ?? []).map((entry: any) => [
    entry.businessName,
    entry.specificationVersion ?? "—",
    <span key="h" style={{ fontFamily: "monospace", fontSize: 12 }}>
      {entry.planHash ? String(entry.planHash).slice(0, 12) : "—"}
    </span>,
    entry.actorUserId ?? "—",
    entry.startedAt ?? "—",
    entry.endedAt ?? "—",
    <StatusBadge
      key="s"
      label={String(entry.status ?? "unknown")}
      tone={entry.partialFailureVisible ? "warning" : "neutral"}
    />,
    (entry.warnings ?? []).length,
  ]);

  return (
    <AdminVtPage
      title="Install history"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <AdminDataTable
        title="Installations"
        headers={["Business", "Spec version", "Plan hash", "Actor", "Started", "Ended", "Status", "Warnings"]}
        rows={rows}
        emptyLabel="No installations recorded."
      />
    </AdminVtPage>
  );
}
