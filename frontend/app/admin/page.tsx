import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { PageHeader } from "@/components/product";
import { cockpitColors, spacing } from "@/design/tokens";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const user = await requirePlatformAdmin();
  const dash = await getAdminPlatformService().getDashboard({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  if (!dash.ok) {
    return <div>Unauthorized</div>;
  }

  const metrics = [
    { id: "total", label: "Businesses", value: dash.metrics.totalBusinesses },
    { id: "active", label: "Active", value: dash.metrics.activeBusinesses },
    { id: "attention", label: "Needs attention", value: dash.metrics.needingAttention },
    { id: "sessions", label: "Architect sessions", value: dash.metrics.recentArchitectSessions },
    { id: "installs", label: "Installs", value: dash.metrics.recentInstallations },
    { id: "failed", label: "Failed/partial", value: dash.metrics.failedOrPartialInstalls },
    { id: "support", label: "Support active", value: dash.metrics.activeSupportSessions },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <PageHeader title="Admin dashboard" description="Platform health from real evidence" />
      <ShellMetricStrip metrics={metrics as never} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: spacing.md }}>
        <ShellPanel title="Platform alerts" subtitle="Truthful status">
          {dash.platformAlerts.length ? dash.platformAlerts.map((alert: any) => (
            <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", padding: `${spacing.xs}px 0` }}>
              <span>{alert.label}</span>
              <StatusBadge label={alert.level} tone="warning" />
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No alerts.</div>}
        </ShellPanel>

        <ShellPanel title="Recent Architect sessions" subtitle="Latest activity">
          {dash.recentSessions.length ? dash.recentSessions.map((session: any) => (
            <div key={session.sessionId} style={{ padding: `${spacing.xs}px 0`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <Link href={`/architect/${session.sessionId}`}>{session.sessionId}</Link>
              <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{session.stage} · {session.status}</div>
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No sessions yet.</div>}
        </ShellPanel>

        <ShellPanel title="Recent installations" subtitle="Failed/partial stay visible">
          {dash.recentInstallations.length ? dash.recentInstallations.map((entry: any) => (
            <div key={`${entry.businessId}-${entry.specificationId}`} style={{ padding: `${spacing.xs}px 0`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
              <div>{entry.businessName}</div>
              <div style={{ color: cockpitColors.textMuted, fontSize: 12 }}>{entry.status}</div>
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No installations yet.</div>}
        </ShellPanel>

        <ShellPanel title="Capability gaps" subtitle="From Architect sessions">
          {dash.capabilityGaps.length ? dash.capabilityGaps.map((gap: any) => (
            <div key={gap.label} style={{ display: "flex", justifyContent: "space-between", padding: `${spacing.xs}px 0` }}>
              <span>{gap.label}</span>
              <strong>{gap.count}</strong>
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No gaps recorded.</div>}
        </ShellPanel>

        <ShellPanel title="Active support" subtitle="Audited sessions">
          {dash.activeSupportSessions.length ? dash.activeSupportSessions.map((session: any) => (
            <div key={session.sessionId} style={{ padding: `${spacing.xs}px 0`, fontSize: 13 }}>
              {session.businessId} · {session.mode}
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No active support sessions.</div>}
        </ShellPanel>

        <ShellPanel title="Recent audit activity" subtitle="Admin actions">
          {dash.recentAudits.length ? dash.recentAudits.slice(0, 8).map((event: any) => (
            <div key={event.id} style={{ padding: `${spacing.xs}px 0`, color: cockpitColors.textMuted, fontSize: 12 }}>
              {event.action} · {event.createdAt}
            </div>
          )) : <div style={{ color: cockpitColors.textMuted }}>No audit events yet.</div>}
        </ShellPanel>
      </div>
    </div>
  );
}
