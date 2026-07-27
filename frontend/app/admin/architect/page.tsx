import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import AdminDataTable from "@/components/admin/AdminDataTable";
import ArchitectSessionCreateForm from "@/components/admin/ArchitectSessionCreateForm";
import StatusBadge from "@/components/product/StatusBadge";
import { VtDockLink, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

export default async function AdminArchitectPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().listArchitectSessions({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  const rows = (result.sessions ?? []).map((session: any) => [
    <Link key="l" href={session.resumeHref} style={{ color: cockpitColors.accent, fontWeight: 700 }}>
      {session.sessionId}
    </Link>,
    session.businessName ?? session.businessId ?? "—",
    session.stageLabel ?? session.stage ?? "—",
    formatArchitectProgress(session.progress),
    (session.gaps ?? []).length,
    session.updatedAt ?? "—",
    <StatusBadge
      key="s"
      label={session.blocked ? "blocked" : String(session.status ?? "open")}
      tone={session.blocked ? "warning" : "neutral"}
    />,
  ]);

  return (
    <AdminVtPage
      title="Architect sessions"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <VtPanel title="Create session for a client">
        <ArchitectSessionCreateForm actorId={user.id} />
      </VtPanel>
      <AdminDataTable
        title="Sessions"
        headers={["Session", "Business", "Stage", "Progress", "Gaps", "Updated", "State"]}
        rows={rows}
        emptyLabel="No Architect sessions yet."
      />
    </AdminVtPage>
  );
}

function formatArchitectProgress(progress: unknown): string {
  if (progress == null || progress === "") return "—";
  if (typeof progress === "string" || typeof progress === "number") return String(progress);
  if (typeof progress === "object") {
    const row = progress as {
      label?: string;
      percent?: number;
      activeStageLabel?: string;
    };
    if (row.label) return row.label;
    if (typeof row.percent === "number") return `${Math.round(row.percent)}%`;
    if (row.activeStageLabel) return row.activeStageLabel;
  }
  return "—";
}
