import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import StatusBadge from "@/components/product/StatusBadge";
import AdminDataTable from "@/components/admin/AdminDataTable";
import { VtDockLink } from "@/components/product/VtChrome";

export default async function AdminBlueprintsPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listBlueprints({ platformRole: user.platformRole });

  const rows = (result.blueprints ?? []).map((blueprint: any) => [
    blueprint.name,
    blueprint.industry ?? "—",
    blueprint.source ?? "—",
    blueprint.version ?? "—",
    blueprint.maturity ?? "—",
    <StatusBadge
      key="g"
      label={blueprint.goldStatus ? "gold" : (blueprint.source === "delivery_moat" ? "moat" : "package")}
      tone={blueprint.goldStatus ? "success" : blueprint.source === "delivery_moat" ? "info" : "neutral"}
    />,
    (blueprint.supportedCapabilities ?? []).length,
    (blueprint.dependencies ?? []).length,
  ]);

  return (
    <AdminVtPage
      title="Blueprint library"
      dock={(
        <>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
          <VtDockLink href="/admin/patterns">Patterns</VtDockLink>
        </>
      )}
    >
      <AdminDataTable
        title="Registered Blueprints"
        headers={["Name", "Industry", "Source", "Version", "Maturity", "Status", "Capabilities", "Dependencies"]}
        rows={rows}
        emptyLabel="No Blueprints registered."
      />
    </AdminVtPage>
  );
}
