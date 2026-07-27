import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import { VtDockLink } from "@/components/product/VtChrome";

export default async function AdminEmployeesPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listEmployeeArchetypes({ platformRole: user.platformRole });

  const rows = (result.archetypes ?? []).map((archetype: any) => [
    archetype.label,
    archetype.purpose,
    (archetype.responsibilities ?? []).join("; "),
    (archetype.approvalLimits ?? []).join(", "),
    archetype.readiness,
  ]);

  return (
    <AdminVtPage
      title="AI employee library"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <AdminDataTable
        title="Archetypes"
        headers={["Employee", "Purpose", "Responsibilities", "Approval limits", "Readiness"]}
        rows={rows}
        emptyLabel="No archetypes registered."
      />
    </AdminVtPage>
  );
}
