import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import { VtDockLink } from "@/components/product/VtChrome";

export default async function AdminComponentsPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listComponents({ platformRole: user.platformRole });

  const rows = (result.components ?? []).map((component: any) => [
    component.name,
    component.type,
    component.family,
    component.category ?? "—",
    (component.permissions ?? []).join(", ") || "—",
    component.responsiveSupport ? "yes" : "no",
    component.darkModeSupport ? "yes" : "no",
  ]);

  return (
    <AdminVtPage
      title="Component library"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <AdminDataTable
        title="Universal components"
        headers={["Name", "Type", "Family", "Category", "Permissions", "Responsive", "Dark mode"]}
        rows={rows}
        emptyLabel="No components registered."
      />
    </AdminVtPage>
  );
}
