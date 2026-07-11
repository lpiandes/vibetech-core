import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService, getAdminSupportService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import SupportEnterForm from "@/components/admin/SupportEnterForm";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const { businessId } = await searchParams;
  const user = await requirePlatformAdmin();
  const service = getAdminPlatformService();
  const businesses = await service.listBusinesses({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });
  const dash = await service.getDashboard({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  const selected = (businesses.businesses ?? []).find((entry: any) => entry.id === businessId)
    ?? (businesses.businesses ?? [])[0]
    ?? null;

  let activeSession = null;
  if (selected) {
    activeSession = await getAdminSupportService().getActiveSession(user.id, selected.id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader
        title="Support access"
        description="Reason required · actor identity retained · no permanent membership"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing.md }}>
        <ShellPanel title="Choose business" subtitle="Then enter with a reason">
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
            {(businesses.businesses ?? []).slice(0, 40).map((business: any) => (
              <a
                key={business.id}
                href={`/admin/support?businessId=${business.id}`}
                style={{
                  padding: spacing.sm,
                  borderRadius: 8,
                  background: selected?.id === business.id ? "rgba(15,23,42,0.06)" : "transparent",
                  textDecoration: "none",
                  color: cockpitColors.textPrimary,
                }}
              >
                {business.name}
              </a>
            ))}
            {!businesses.businesses?.length ? (
              <div style={{ color: cockpitColors.textMuted }}>No businesses available.</div>
            ) : null}
          </div>
        </ShellPanel>

        <ShellPanel title="Enter support session" subtitle="Read-only or elevated per policy">
          {selected ? (
            <>
              <SupportEnterForm businessId={selected.id} businessName={selected.name} />
              {activeSession ? (
                <div style={{ marginTop: spacing.md, color: cockpitColors.textMuted, fontSize: 13 }}>
                  Active: {activeSession.mode} · {activeSession.reason}
                </div>
              ) : null}
            </>
          ) : (
            <div style={{ color: cockpitColors.textMuted }}>Select a business first.</div>
          )}
        </ShellPanel>

        <ShellPanel title="Active support sessions" subtitle="Platform-wide">
          {(dash.activeSupportSessions ?? []).length ? dash.activeSupportSessions.map((session: any) => (
            <div key={session.sessionId} style={{ padding: `${spacing.xs}px 0`, fontSize: 13 }}>
              {session.businessId} · {session.mode} · {session.reason}
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No active sessions.</div>}
        </ShellPanel>

        <ShellPanel title="Recent audit activity" subtitle="Support and admin actions">
          {(dash.recentAudits ?? []).slice(0, 12).map((event: any) => (
            <div key={event.id} style={{ padding: `${spacing.xs}px 0`, color: cockpitColors.textMuted, fontSize: 12 }}>
              {event.action} · {event.createdAt}
            </div>
          ))}
        </ShellPanel>
      </div>
    </div>
  );
}
