import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import { PageHeader } from "@/components/product";
import ShellPanel from "@/components/shell/ShellPanel";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import { cockpitColors, spacing } from "@/design/tokens";

export default async function AdminAnalyticsPage() {
  const user = await requirePlatformAdmin();
  const result = await getAdminPlatformService().getPlatformAnalytics({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  if (!result.ok) return <div>Unauthorized</div>;

  const metrics = [
    { id: "biz", label: "Businesses", value: result.metrics.totalBusinesses },
    { id: "install", label: "Failed/partial installs", value: result.installationOutcomes.failedOrPartial },
    { id: "support", label: "Active support", value: result.activeSupportSessions },
    { id: "bp", label: "Blueprints", value: result.blueprintUsage },
    { id: "comp", label: "Components", value: result.componentUsage },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Platform analytics" description="Truthful metrics only — no fabricated revenue" />
      <ShellMetricStrip metrics={metrics as never} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: spacing.md }}>
        <ShellPanel title="Businesses by readiness" subtitle="From install evidence">
          {Object.entries(result.businessesByReadiness ?? {}).map(([status, count]) => (
            <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: `${spacing.xs}px 0` }}>
              <span>{status}</span>
              <strong>{count as number}</strong>
            </div>
          ))}
          {!Object.keys(result.businessesByReadiness ?? {}).length ? (
            <div style={{ color: cockpitColors.textMuted }}>No install readiness evidence yet.</div>
          ) : null}
        </ShellPanel>

        <ShellPanel title="Architect completion" subtitle="Recent sessions">
          <div>Total recent: {result.architectCompletion.total}</div>
          <div>Blocked/failed: {result.architectCompletion.blocked}</div>
        </ShellPanel>

        <ShellPanel title="Common capability gaps" subtitle="From Architect sessions">
          {(result.commonCapabilityGaps ?? []).map((gap: any) => (
            <div key={gap.label} style={{ display: "flex", justifyContent: "space-between", padding: `${spacing.xs}px 0` }}>
              <span>{gap.label}</span>
              <strong>{gap.count}</strong>
            </div>
          ))}
          {!result.commonCapabilityGaps?.length ? (
            <div style={{ color: cockpitColors.textMuted }}>No gaps recorded.</div>
          ) : null}
        </ShellPanel>
      </div>
    </div>
  );
}
