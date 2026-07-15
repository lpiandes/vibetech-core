import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { getAdminPlatformService } from "@/lib/admin/getAdminServices";
import StatusBadge from "@/components/product/StatusBadge";
import { PageHeader } from "@/components/product";
import { cockpitColors, radius, typography } from "@/design/tokens";

/**
 * Platform admin home — sparse, evidence-only, one row per business.
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

  const metrics = [
    { id: "total", label: "Businesses", value: dash.metrics.totalBusinesses, href: "/admin/businesses" },
    { id: "attention", label: "Needs you", value: dash.metrics.needingAttention, href: "/admin/businesses" },
    { id: "installs", label: "Live installs", value: dash.metrics.installations ?? dash.metrics.recentInstallations, href: "/admin/installations" },
    { id: "support", label: "Support open", value: dash.metrics.activeSupportSessions, href: "/admin/support" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1080 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <PageHeader
          title="Admin"
          description="Real businesses only — pilot and script noise stays out."
        />
        <div style={{ display: "flex", gap: 10 }}>
          <AdminLink href="/admin/businesses" primary>
            Businesses
          </AdminLink>
          <AdminLink href="/platform">Create & invite</AdminLink>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {metrics.map((metric) => (
          <Link
            key={metric.id}
            href={metric.href}
            style={{
              textDecoration: "none",
              color: "inherit",
              background: cockpitColors.panel,
              border: `1px solid ${cockpitColors.panelBorder}`,
              borderRadius: radius.medium,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 12, color: cockpitColors.textMuted, marginBottom: 6 }}>{metric.label}</div>
            <div style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.03em", color: cockpitColors.textPrimary }}>
              {metric.value}
            </div>
          </Link>
        ))}
      </div>

      {dash.platformAlerts.length ? (
        <section style={sectionStyle}>
          <SectionTitle title="Alerts" />
          <div style={{ display: "grid", gap: 8 }}>
            {dash.platformAlerts.map((alert: any) => (
              <div key={alert.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span style={{ color: cockpitColors.textPrimary }}>{alert.label}</span>
                <StatusBadge label={alert.level} tone="warning" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
        <section style={sectionStyle}>
          <SectionTitle title="Businesses" action={<QuietHref href="/admin/businesses">View all</QuietHref>} />
          {dash.businesses?.length ? (
            <div style={{ display: "grid", gap: 0 }}>
              {dash.businesses.map((business: any) => (
                <Link
                  key={business.id}
                  href={business.href}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{business.name}</span>
                  <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>{humanStatus(business.status)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>No live businesses yet. Create one and invite an owner.</Empty>
          )}
        </section>

        <section style={sectionStyle}>
          <SectionTitle title="Latest Ask activity" action={<QuietHref href="/admin/architect">Sessions</QuietHref>} />
          {dash.recentSessions.length ? (
            <div style={{ display: "grid", gap: 0 }}>
              {dash.recentSessions.map((session: any) => (
                <Link
                  key={session.sessionId}
                  href={session.href || `/architect/${session.sessionId}`}
                  style={{
                    display: "grid",
                    gap: 2,
                    padding: "12px 0",
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{session.businessName || "Untitled business"}</span>
                  <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>
                    {session.stageLabel || session.stage || "In progress"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>No Ask activity yet.</Empty>
          )}
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={sectionStyle}>
          <SectionTitle title="Installs" />
          {dash.recentInstallations.length ? (
            <div style={{ display: "grid", gap: 0 }}>
              {dash.recentInstallations.map((entry: any) => (
                <div
                  key={`${entry.businessId}-${entry.specificationId}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{entry.businessName}</span>
                  <span style={{ color: cockpitColors.textMuted, fontSize: 13 }}>{humanStatus(entry.status)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No installations yet.</Empty>
          )}
        </section>

        <section style={sectionStyle}>
          <SectionTitle title="Recent activity" />
          {dash.recentAudits.length ? (
            <div style={{ display: "grid", gap: 0 }}>
              {dash.recentAudits.map((event: any) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  <span>{event.label || event.action}</span>
                  <span style={{ color: cockpitColors.textMuted, fontSize: 13, whiteSpace: "nowrap" }}>
                    {event.when || ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Quiet for now.</Empty>
          )}
        </section>
      </div>

      {dash.capabilityGaps.length ? (
        <section style={sectionStyle}>
          <SectionTitle title="Common gaps" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {dash.capabilityGaps.slice(0, 6).map((gap: any) => (
              <span
                key={gap.label}
                style={{
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 13,
                  color: cockpitColors.textSecondary,
                }}
              >
                {String(gap.label).replace(/_/g, " ")} · {gap.count}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SectionTitle({ title, action = null }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</h2>
      {action}
    </div>
  );
}

function QuietHref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ color: cockpitColors.accent, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
      {children}
    </Link>
  );
}

function AdminLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        height: 36,
        padding: "0 14px",
        borderRadius: radius.medium,
        background: primary ? cockpitColors.accent : cockpitColors.panel,
        color: primary ? "#fff" : cockpitColors.textPrimary,
        border: primary ? "none" : `1px solid ${cockpitColors.panelBorder}`,
        fontWeight: 650,
        fontSize: typography.button.fontSize,
      }}
    >
      {children}
    </Link>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color: cockpitColors.textMuted, fontSize: 14, padding: "8px 0" }}>{children}</div>;
}

function humanStatus(value: string | null | undefined) {
  const key = String(value ?? "").toLowerCase();
  if (key === "installed" || key === "active") return "Live";
  if (key === "partial" || key === "failed") return "Needs attention";
  if (!key) return "—";
  return key.replace(/_/g, " ");
}

const sectionStyle: CSSProperties = {
  background: cockpitColors.panel,
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: 18,
  padding: 20,
};
