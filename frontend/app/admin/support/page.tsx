import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService, getAdminSupportService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import SupportEnterForm from "@/components/admin/SupportEnterForm";
import { VtCard, VtDockLink, VtEmpty, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

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
    <AdminVtPage
      title="Support access"
      statusLabel={selected ? selected.name : "Select business"}
      statusTone={activeSession ? "warn" : "neutral"}
      dock={(
        <>
          <VtDockLink href="/admin/businesses">Businesses</VtDockLink>
          <VtDockLink href="/admin">Dashboard</VtDockLink>
        </>
      )}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <VtPanel title="Choose business">
          <div style={{ display: "grid", gap: 6 }}>
            {(businesses.businesses ?? []).slice(0, 40).map((business: any) => (
              <a
                key={business.id}
                href={`/admin/support?businessId=${business.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <VtCard
                  padding={12}
                  accent={selected?.id === business.id}
                >
                  <span style={{ fontWeight: selected?.id === business.id ? 800 : 600 }}>
                    {business.name}
                  </span>
                </VtCard>
              </a>
            ))}
            {!businesses.businesses?.length ? (
              <VtEmpty label="No businesses available." />
            ) : null}
          </div>
        </VtPanel>

        <VtPanel title="Enter support session">
          {selected ? (
            <>
              <SupportEnterForm businessId={selected.id} businessName={selected.name} />
              {activeSession ? (
                <div style={{ marginTop: 12, color: cockpitColors.textMuted, fontSize: 13 }}>
                  Active: {activeSession.mode} · {activeSession.reason}
                </div>
              ) : null}
            </>
          ) : (
            <VtEmpty label="Select a business first." />
          )}
        </VtPanel>

        <VtPanel title="Active support sessions">
          {(dash.activeSupportSessions ?? []).length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dash.activeSupportSessions.map((session: any) => (
                <VtCard key={session.sessionId} padding={12}>
                  <div style={{ fontSize: 13 }}>
                    {session.businessId} · {session.mode} · {session.reason}
                  </div>
                </VtCard>
              ))}
            </div>
          ) : (
            <VtEmpty label="No active sessions." />
          )}
        </VtPanel>

        <VtPanel title="Recent audit activity">
          {(dash.recentAudits ?? []).length ? (
            <div style={{ display: "grid", gap: 6 }}>
              {(dash.recentAudits ?? []).slice(0, 12).map((event: any) => (
                <div key={event.id} style={{ color: cockpitColors.textMuted, fontSize: 12 }}>
                  {event.action} · {event.createdAt}
                </div>
              ))}
            </div>
          ) : (
            <VtEmpty label="No recent audits." />
          )}
        </VtPanel>
      </div>
    </AdminVtPage>
  );
}
