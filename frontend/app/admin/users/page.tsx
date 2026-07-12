import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminUsersPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listPlatformUsers({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Platform users" description="Admins, owners, and members — tenant boundaries respected" />
      <ShellPanel title="Users" subtitle="Platform role shown when assigned">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Name", "Email", "Platform role", "Created"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.users ?? []).map((entry: any) => (
                <tr key={entry.id}>
                  <td style={{ padding: 8 }}>{entry.name ?? "—"}</td>
                  <td style={{ padding: 8 }}>{entry.email}</td>
                  <td style={{ padding: 8 }}>
                    {entry.platformRole
                      ? <StatusBadge label={String(entry.platformRole)} tone="neutral" />
                      : "—"}
                  </td>
                  <td style={{ padding: 8, color: cockpitColors.textMuted }}>
                    {entry.createdAt ? String(entry.createdAt).slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.users?.length ? (
            <div style={{ color: cockpitColors.textMuted, padding: spacing.md }}>No users found.</div>
          ) : null}
        </div>
      </ShellPanel>
    </div>
  );
}
