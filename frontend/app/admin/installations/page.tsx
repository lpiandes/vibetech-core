import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminInstallationsPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listInstallations({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Install history" description="Partial failures stay visible" />
      <ShellPanel title="Installations" subtitle="Specification, plan hash, actor, and outcome">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Business", "Spec version", "Plan hash", "Actor", "Started", "Ended", "Status", "Warnings"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.installations ?? []).map((entry: any) => (
                <tr key={`${entry.businessId}-${entry.specificationId ?? entry.planId}`}>
                  <td style={{ padding: 8 }}>{entry.businessName}</td>
                  <td style={{ padding: 8 }}>{entry.specificationVersion ?? "—"}</td>
                  <td style={{ padding: 8, fontFamily: "monospace", fontSize: 12 }}>{entry.planHash ? String(entry.planHash).slice(0, 12) : "—"}</td>
                  <td style={{ padding: 8 }}>{entry.actorUserId ?? "—"}</td>
                  <td style={{ padding: 8 }}>{entry.startedAt ?? "—"}</td>
                  <td style={{ padding: 8 }}>{entry.endedAt ?? "—"}</td>
                  <td style={{ padding: 8 }}>
                    <StatusBadge
                      label={String(entry.status ?? "unknown")}
                      tone={entry.partialFailureVisible ? "warning" : "neutral"}
                    />
                  </td>
                  <td style={{ padding: 8 }}>{(entry.warnings ?? []).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.installations?.length ? (
            <div style={{ color: cockpitColors.textMuted, padding: spacing.md }}>No installations recorded.</div>
          ) : null}
        </div>
      </ShellPanel>
    </div>
  );
}
