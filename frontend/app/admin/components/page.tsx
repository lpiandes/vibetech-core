import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminComponentsPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listComponents({ platformRole: user.platformRole });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Component library" description="Registered universal components — read-only" />
      <ShellPanel title="Universal components" subtitle="Usage counts appear when install evidence exists">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Type", "Family", "Category", "Permissions", "Responsive", "Dark mode"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.components ?? []).map((component: any) => (
                <tr key={component.type}>
                  <td style={{ padding: 8 }}>{component.name}</td>
                  <td style={{ padding: 8 }}>{component.type}</td>
                  <td style={{ padding: 8 }}>{component.family}</td>
                  <td style={{ padding: 8 }}>{component.category ?? "—"}</td>
                  <td style={{ padding: 8 }}>{(component.permissions ?? []).join(", ") || "—"}</td>
                  <td style={{ padding: 8 }}>{component.responsiveSupport ? "yes" : "no"}</td>
                  <td style={{ padding: 8 }}>{component.darkModeSupport ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellPanel>
    </div>
  );
}
