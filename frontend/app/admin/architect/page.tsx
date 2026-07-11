import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing } from "@/design/tokens";
import Link from "next/link";
import ArchitectSessionCreateForm from "@/components/admin/ArchitectSessionCreateForm";

export default async function AdminArchitectPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listArchitectSessions({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Architect sessions" description="Builder sessions across permitted businesses" />
      <ShellPanel title="Create session for a client" subtitle="Invite the owner later — you do not become owner">
        <ArchitectSessionCreateForm actorId={user.id} />
      </ShellPanel>
      <ShellPanel title="Sessions" subtitle="Resume links keep admin identity">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Session", "Business", "Stage", "Progress", "Gaps", "Updated", "State"].map((label) => (
                  <th key={label} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.sessions ?? []).map((session: any) => (
                <tr key={session.sessionId}>
                  <td style={{ padding: 8 }}><Link href={session.resumeHref}>{session.sessionId}</Link></td>
                  <td style={{ padding: 8 }}>{session.businessId ?? "—"}</td>
                  <td style={{ padding: 8 }}>{session.stage ?? "—"}</td>
                  <td style={{ padding: 8 }}>{session.progress ?? "—"}</td>
                  <td style={{ padding: 8 }}>{(session.gaps ?? []).length}</td>
                  <td style={{ padding: 8 }}>{session.updatedAt ?? "—"}</td>
                  <td style={{ padding: 8 }}>
                    <StatusBadge label={session.blocked ? "blocked" : String(session.status ?? "open")} tone={session.blocked ? "warning" : "neutral"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!result.sessions?.length ? (
            <div style={{ color: cockpitColors.textMuted, padding: spacing.md }}>No Architect sessions yet.</div>
          ) : null}
        </div>
      </ShellPanel>
    </div>
  );
}
