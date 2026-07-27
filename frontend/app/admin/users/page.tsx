import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import StatusBadge from "@/components/product/StatusBadge";
import { VtDockLink } from "@/components/product/VtChrome";

export default async function AdminUsersPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listPlatformUsers({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  const rows = (result.users ?? []).map((entry: any) => [
    entry.name ?? "—",
    entry.email,
    entry.platformRole
      ? <StatusBadge key="r" label={String(entry.platformRole)} tone="neutral" />
      : "—",
    entry.createdAt ? String(entry.createdAt).slice(0, 10) : "—",
  ]);

  return (
    <AdminVtPage
      title="Platform users"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <AdminDataTable
        title="Users"
        headers={["Name", "Email", "Platform role", "Created"]}
        rows={rows}
        emptyLabel="No users found."
      />
    </AdminVtPage>
  );
}
