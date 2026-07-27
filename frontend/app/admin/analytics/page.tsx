import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import { VtCard, VtDockLink, VtEmpty, VtMetricStrip, VtPanel } from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

export default async function AdminAnalyticsPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().getPlatformAnalytics({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  if (!result.ok) return <div>Unauthorized</div>;

  return (
    <AdminVtPage
      title="Platform analytics"
      dock={<VtDockLink href="/admin">Dashboard</VtDockLink>}
    >
      <VtMetricStrip
        items={[
          { label: "Businesses", value: String(result.metrics.totalBusinesses) },
          { label: "Failed/partial installs", value: String(result.installationOutcomes.failedOrPartial) },
          { label: "Active support", value: String(result.activeSupportSessions) },
          { label: "Blueprints", value: String(result.blueprintUsage) },
          { label: "Components", value: String(result.componentUsage) },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <VtPanel title="Businesses by readiness">
          {Object.keys(result.businessesByReadiness ?? {}).length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {Object.entries(result.businessesByReadiness ?? {}).map(([status, count]) => (
                <VtCard key={status} padding={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{status}</span>
                    <strong>{count as number}</strong>
                  </div>
                </VtCard>
              ))}
            </div>
          ) : (
            <VtEmpty label="No install readiness evidence yet." />
          )}
        </VtPanel>

        <VtPanel title="Architect completion">
          <VtCard padding={14}>
            <div style={{ color: cockpitColors.textPrimary, lineHeight: 1.6 }}>
              <div>Total recent: <strong>{result.architectCompletion.total}</strong></div>
              <div>Blocked/failed: <strong>{result.architectCompletion.blocked}</strong></div>
            </div>
          </VtCard>
        </VtPanel>

        <VtPanel title="Common capability gaps">
          {(result.commonCapabilityGaps ?? []).length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {(result.commonCapabilityGaps ?? []).map((gap: any) => (
                <VtCard key={gap.label} padding={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{gap.label}</span>
                    <strong>{gap.count}</strong>
                  </div>
                </VtCard>
              ))}
            </div>
          ) : (
            <VtEmpty label="No gaps recorded." />
          )}
        </VtPanel>
      </div>
    </AdminVtPage>
  );
}
