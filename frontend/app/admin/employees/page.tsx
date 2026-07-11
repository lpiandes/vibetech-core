import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminEmployeesPage() {
  const user = await requirePlatformAdmin();
  const result = getAdminPlatformService().listEmployeeArchetypes({ platformRole: user.platformRole });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="AI employee library" description="Reusable archetypes — no raw internal IDs in the primary label" />
      <ShellPanel title="Archetypes" subtitle="Installed variants appear per-business after install">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Employee", "Purpose", "Responsibilities", "Approval limits", "Readiness"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.archetypes ?? []).map((archetype: any) => (
                <tr key={archetype.archetypeId}>
                  <td style={{ padding: 8 }}>{archetype.label}</td>
                  <td style={{ padding: 8 }}>{archetype.purpose}</td>
                  <td style={{ padding: 8 }}>{(archetype.responsibilities ?? []).join("; ")}</td>
                  <td style={{ padding: 8 }}>{(archetype.approvalLimits ?? []).join(", ")}</td>
                  <td style={{ padding: 8 }}>{archetype.readiness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellPanel>
    </div>
  );
}
