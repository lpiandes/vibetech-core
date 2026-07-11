import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminBlueprintsPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listBlueprints({ platformRole: user.platformRole });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Blueprint library" description="Gold, package, and template Blueprints — inspect only" />
      <ShellPanel title="Registered Blueprints" subtitle="No marketplace commerce">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Industry", "Version", "Maturity", "Gold", "Capabilities", "Dependencies"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.blueprints ?? []).map((blueprint: any) => (
                <tr key={blueprint.blueprintId}>
                  <td style={{ padding: 8 }}>{blueprint.name}</td>
                  <td style={{ padding: 8 }}>{blueprint.industry ?? "—"}</td>
                  <td style={{ padding: 8 }}>{blueprint.version ?? "—"}</td>
                  <td style={{ padding: 8 }}>{blueprint.maturity ?? "—"}</td>
                  <td style={{ padding: 8 }}>
                    <StatusBadge label={blueprint.goldStatus ? "gold" : "package"} tone={blueprint.goldStatus ? "success" : "neutral"} />
                  </td>
                  <td style={{ padding: 8 }}>{(blueprint.supportedCapabilities ?? []).length}</td>
                  <td style={{ padding: 8 }}>{(blueprint.dependencies ?? []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.blueprints?.length ? (
            <div style={{ color: cockpitColors.textMuted, padding: spacing.md }}>No Blueprints registered.</div>
          ) : null}
        </div>
      </ShellPanel>
    </div>
  );
}
