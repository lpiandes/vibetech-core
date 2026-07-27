import Link from "next/link";
import type { ReactNode } from "react";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import AdminVtPage from "@/components/admin/AdminVtPage";
import StatusBadge from "@/components/product/StatusBadge";
import {
  VtCard,
  VtDockLink,
  VtEmpty,
  VtMetricStrip,
  VtPanel,
} from "@/components/product/VtChrome";
import { cockpitColors } from "@/design/tokens";

/**
 * Platform admin home — VtChrome cards, operator queue first.
 */
export default async function AdminDashboardPage() {
  const user = await requirePlatformAdmin();
  const dash = await getAdminPlatformService().getDashboard({
    adminUserId: user.id,
    platformRole: user.platformRole,
  });

  if (!dash.ok) {
    return <div>Unauthorized</div>;
  }

  const operatorActions = Array.isArray((dash as any).operatorActions) ? (dash as any).operatorActions : [];
  const needingYou = Number(dash.metrics.needingAttention ?? operatorActions.length ?? 0);

  return (
    <AdminVtPage
      title="Platform control"
      eyebrow="Admin"
      statusLabel={needingYou > 0 ? `${needingYou} needs you` : "Clear"}
      statusTone={needingYou > 0 ? "warn" : "live"}
      dock={(
        <>
          <VtDockLink href="/platform">Create & invite</VtDockLink>
          <VtDockLink href="/admin/health">Health</VtDockLink>
          <VtDockLink href="/admin/businesses">Businesses</VtDockLink>
          <VtDockLink href="/admin/support">Support</VtDockLink>
        </>
      )}
    >
      <VtMetricStrip
        items={[
          { label: "Businesses", value: dash.metrics.totalBusinesses, hint: "Live directory" },
          { label: "Needs you", value: needingYou, hint: "Platform exceptions" },
          {
            label: "Live installs",
            value: dash.metrics.installations ?? dash.metrics.recentInstallations,
            hint: "Installed OS",
          },
          { label: "Support open", value: dash.metrics.activeSupportSessions, hint: "Active sessions" },
        ]}
      />

      <VtPanel
        title="Platform exceptions — fix these now"
        right={operatorActions.length ? <StatusBadge label={`${operatorActions.length} open`} tone="warning" /> : null}
      >
        {operatorActions.length ? (
          <div style={{ display: "grid", gap: 12 }}>
            {operatorActions.map((action: any) => (
              <VtCard key={action.id} padding={16} accent={String(action.urgency) === "critical"}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: cockpitColors.textPrimary }}>{action.title}</div>
                    <div style={{ marginTop: 4, fontSize: 13, color: cockpitColors.textSecondary, lineHeight: 1.45 }}>
                      {action.summary}
                    </div>
                  </div>
                  <StatusBadge label={String(action.urgency ?? "high")} tone="warning" />
                </div>
                <ol style={{ margin: "12px 0 0", paddingLeft: 18, color: cockpitColors.textPrimary, fontSize: 13, lineHeight: 1.55 }}>
                  {(action.steps ?? []).map((step: string) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {action.payload ? (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, color: cockpitColors.accent }}>
                      All info you need (copy this)
                    </summary>
                    <pre style={{
                      marginTop: 8,
                      padding: 12,
                      borderRadius: 12,
                      background: cockpitColors.inset,
                      overflow: "auto",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                    >
                      {JSON.stringify(action.payload, null, 2)}
                    </pre>
                  </details>
                ) : null}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <Link href={action.href} style={ctaPrimary}>Open in Admin</Link>
                  {action.workspaceHref ? (
                    <Link href={action.workspaceHref} style={ctaSecondary}>Open workspace</Link>
                  ) : null}
                </div>
              </VtCard>
            ))}
          </div>
        ) : (
          <VtEmpty label="Nothing waiting on you. A2P, failed installs, and similar work land here with exact steps." />
        )}
      </VtPanel>

      {dash.platformAlerts.length ? (
        <VtPanel title="Alerts">
          <div style={{ display: "grid", gap: 8 }}>
            {dash.platformAlerts.map((alert: any) => (
              <VtCard key={alert.id} padding={12}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span style={{ color: cockpitColors.textPrimary, fontWeight: 700 }}>{alert.label}</span>
                  <StatusBadge label={alert.level} tone="warning" />
                </div>
              </VtCard>
            ))}
          </div>
        </VtPanel>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <VtPanel title="Businesses" right={<QuietHref href="/admin/businesses">View all</QuietHref>}>
          {dash.businesses?.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dash.businesses.map((business: any) => (
                <Link key={business.id} href={business.href} style={{ textDecoration: "none" }}>
                  <VtCard padding={12}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontWeight: 800, color: cockpitColors.textPrimary }}>{business.name}</span>
                      <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>{humanStatus(business.status)}</span>
                    </div>
                  </VtCard>
                </Link>
              ))}
            </div>
          ) : (
            <VtEmpty label="No live businesses yet. Create one and invite an owner." />
          )}
        </VtPanel>

        <VtPanel title="Latest Ask activity" right={<QuietHref href="/admin/architect">Sessions</QuietHref>}>
          {dash.recentSessions.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dash.recentSessions.map((session: any) => (
                <Link
                  key={session.sessionId}
                  href={session.href || `/architect/${session.sessionId}`}
                  style={{ textDecoration: "none" }}
                >
                  <VtCard padding={12}>
                    <div style={{ fontWeight: 800, color: cockpitColors.textPrimary }}>
                      {session.businessName || "Untitled business"}
                    </div>
                    <div style={{ color: cockpitColors.textMuted, fontSize: 13, marginTop: 2 }}>
                      {session.stageLabel || session.stage || "In progress"}
                    </div>
                  </VtCard>
                </Link>
              ))}
            </div>
          ) : (
            <VtEmpty label="No Ask activity yet." />
          )}
        </VtPanel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <VtPanel title="Installs" right={<QuietHref href="/admin/installations">All</QuietHref>}>
          {dash.recentInstallations.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dash.recentInstallations.map((entry: any) => (
                <VtCard key={`${entry.businessId}-${entry.specificationId}`} padding={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontWeight: 800 }}>{entry.businessName}</span>
                    <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>{humanStatus(entry.status)}</span>
                  </div>
                </VtCard>
              ))}
            </div>
          ) : (
            <VtEmpty label="No installations yet." />
          )}
        </VtPanel>

        <VtPanel title="Recent activity">
          {dash.recentAudits.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {dash.recentAudits.map((event: any) => (
                <VtCard key={event.id} padding={12}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{event.label || event.action}</span>
                    <span style={{ color: cockpitColors.textMuted, fontSize: 13, whiteSpace: "nowrap" }}>
                      {event.when || ""}
                    </span>
                  </div>
                </VtCard>
              ))}
            </div>
          ) : (
            <VtEmpty label="Quiet for now." />
          )}
        </VtPanel>
      </div>

      {dash.capabilityGaps.length ? (
        <VtPanel title="Common gaps">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {dash.capabilityGaps.slice(0, 8).map((gap: any) => (
              <span
                key={gap.label}
                style={{
                  border: `2px solid ${cockpitColors.panelBorder}`,
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: cockpitColors.textSecondary,
                  background: "#fff",
                }}
              >
                {String(gap.label).replace(/_/g, " ")} · {gap.count}
              </span>
            ))}
          </div>
        </VtPanel>
      ) : null}
    </AdminVtPage>
  );
}

function QuietHref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ color: cockpitColors.accent, textDecoration: "none", fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {children}
    </Link>
  );
}

function humanStatus(value: string | null | undefined) {
  const key = String(value ?? "").toLowerCase();
  if (key === "installed" || key === "active") return "Live";
  if (key === "partial" || key === "failed") return "Needs attention";
  if (!key) return "—";
  return key.replace(/_/g, " ");
}

const ctaPrimary = {
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 12,
  background: cockpitColors.accent,
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
};

const ctaSecondary = {
  ...ctaPrimary,
  background: "#fff",
  color: cockpitColors.textPrimary,
  border: `2px solid ${cockpitColors.panelBorder}`,
};
