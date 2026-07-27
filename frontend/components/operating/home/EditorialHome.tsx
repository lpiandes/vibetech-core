"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, BarChart3, BriefcaseBusiness, CheckCircle2, CircleAlert, ClipboardCheck, LoaderCircle, Mail, PlugZap, UsersRound } from "lucide-react";
import { cockpitColors, spacing, radius } from "@/design/tokens";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

/**
 * Mockup-density Operating Home primitives.
 * White cards on cool gray canvas — labels/values always from callers (no industry copy).
 */

export function HomeCanvas({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        margin: `-${spacing.lg} -${spacing.lg} -${spacing.xl}`,
        padding: `${spacing.lg} ${spacing.lg} ${spacing["2xl"]}`,
        minHeight: "calc(100vh - 72px)",
        background: "#eef1f4",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gap: spacing.md,
        }}
      >
        {children}
      </div>
      <style>{`
        .vt-operating-status { display: grid; gap: 8px; padding: 13px 16px; background: #fff; border: 1px solid rgba(15, 23, 42, .07); border-radius: 16px; box-shadow: 0 8px 24px rgba(15,23,42,.035); }
        .vt-operating-status-title { font-size: 11px; color: #64748b; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .vt-operating-status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .vt-status-chip { min-width: 0; display: flex; align-items: flex-start; gap: 9px; padding: 9px; color: #334155; border-radius: 10px; background: #f8fafc; text-decoration: none; }
        .vt-status-chip:hover { background: #f1f5f9; }
        .vt-status-chip strong, .vt-status-chip small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vt-status-chip strong { font-size: 12px; color: #0f172a; line-height: 1.35; }
        .vt-status-chip small { margin-top: 2px; font-size: 11px; color: #64748b; line-height: 1.35; }
        .vt-status-good svg { color: #059669; } .vt-status-warning svg { color: #d97706; } .vt-status-default svg { color: #2563eb; }
        .vt-dash-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }
        .vt-dash-metrics {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }
        .vt-dash-card {
          background: #fff;
          border: 1px solid #e8edf2;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035), 0 8px 22px rgba(15, 23, 42, 0.035);
        }
        .vt-dash-row-interactive { cursor: pointer; }
        .vt-dash-row-interactive:hover { background: rgba(15, 118, 110, 0.04); }
        .vt-dash-metric-interactive { cursor: pointer; text-decoration: none; color: inherit; display: grid; gap: 6px; }
        .vt-dash-metric-interactive:hover { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 118, 110, 0.10); }
        @media (max-width: 1100px) {
          .vt-dash-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .vt-dash-grid-3 { grid-template-columns: 1fr 1fr; }
          .vt-operating-status-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .vt-dash-metrics, .vt-dash-grid-3, .vt-operating-status-grid { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .vt-dash-card { transition: none !important; }
        }
        .vt-simple-row-link:hover > div { background: rgba(15, 118, 110, 0.04); }
        .vt-home-panel-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .vt-home-panel-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .vt-home-panel-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export function HomeHero({
  greeting,
  subtitle,
}: {
  greeting: string;
  subtitle?: string;
}) {
  return (
    <header style={{ display: "grid", gap: 6, paddingTop: 4 }}>
      <h1
        style={{
          margin: 0,
          fontSize: "1.75rem",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          color: cockpitColors.textPrimary,
          fontFamily: "inherit",
        }}
      >
        {scrubInternalWording(greeting)}
      </h1>
      {subtitle ? (
        <p style={{ margin: 0, fontSize: "0.95rem", color: cockpitColors.textMuted, lineHeight: 1.45 }}>
          {scrubInternalWording(subtitle)}
        </p>
      ) : null}
    </header>
  );
}

/** A truthful health readout: it only summarizes live setup, attention, and teammate state. */
export function OperatingStatusBar({
  setupComplete,
  setupRemaining,
  attentionCount,
  workingCount,
  workforce,
  integrationsHref,
  attentionHref,
  teamHref,
}: {
  setupComplete: boolean;
  setupRemaining: number;
  attentionCount: number;
  workingCount: number;
  workforce: Array<{ status?: string | null }>;
  integrationsHref?: string | null;
  attentionHref?: string | null;
  teamHref?: string | null;
}) {
  const blocked = workforce.filter((member) => /blocked|needs_setup|needs_approval/i.test(String(member.status ?? ""))).length;
  const chips = [
    {
      id: "setup",
      label: setupComplete ? "Platform connected" : `${setupRemaining} setup step${setupRemaining === 1 ? "" : "s"} remaining`,
      detail: setupComplete ? "Connections are ready" : "Some tools cannot run yet",
      tone: setupComplete ? "good" : "warning",
      href: integrationsHref,
      icon: setupComplete ? CheckCircle2 : PlugZap,
    },
    {
      id: "attention",
      label: attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need you` : "Nothing needs your decision",
      detail: attentionCount ? "Review before work can continue" : "You are all caught up",
      tone: attentionCount ? "warning" : "good",
      href: attentionHref,
      icon: attentionCount ? CircleAlert : CheckCircle2,
    },
    {
      id: "work",
      label: workingCount ? `${workingCount} item${workingCount === 1 ? "" : "s"} in progress` : "No active work right now",
      detail: workingCount ? "VIBETech is working from live records" : "New work will appear here",
      tone: "default",
      href: null,
      icon: LoaderCircle,
    },
    {
      id: "team",
      label: blocked ? `${blocked} teammate${blocked === 1 ? "" : "s"} need setup` : `${workforce.length} AI teammate${workforce.length === 1 ? "" : "s"} monitored`,
      detail: blocked ? "Open the team to see what is blocked" : "Status is based on current assignments",
      tone: blocked ? "warning" : "default",
      href: teamHref,
      icon: UsersRound,
    },
  ];
  return (
    <section aria-label="Operating status" className="vt-operating-status">
      <div className="vt-operating-status-title">Operating status</div>
      <div className="vt-operating-status-grid">
        {chips.map((chip) => {
          const Icon = chip.icon;
          const body = <><Icon size={17} aria-hidden /><span><strong>{chip.label}</strong><small>{chip.detail}</small></span></>;
          return chip.href
            ? <Link key={chip.id} href={chip.href} className={`vt-status-chip vt-status-${chip.tone}`}>{body}</Link>
            : <div key={chip.id} className={`vt-status-chip vt-status-${chip.tone}`}>{body}</div>;
        })}
      </div>
    </section>
  );
}

export function MetricStrip({
  metrics,
}: {
  metrics: Array<{
    id: string;
    label: string;
    value: string | number;
    detail?: string | null;
    tone?: "default" | "attention" | "good";
    href?: string | null;
  }>;
}) {
  if (!metrics.length) return null;
  return (
    <div className="vt-dash-metrics" aria-label="Business snapshot">
      {metrics.map((metric) => {
        const visual = metricVisual(metric.label, metric.tone);
        const Icon = visual.icon;
        const body = (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <span aria-hidden style={{ width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 11, color: visual.color, background: visual.background, flexShrink: 0 }}>
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <div style={{ minWidth: 0, paddingTop: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 650, color: cockpitColors.textMuted, lineHeight: 1.3 }}>
                  {scrubInternalWording(metric.label)}
                </div>
                <div style={{ marginTop: 5, fontSize: "1.7rem", fontWeight: 760, letterSpacing: "-0.04em", color: cockpitColors.textPrimary, lineHeight: 1.05 }}>
                  {metric.value}
                </div>
              </div>
            </div>
            {metric.detail ? (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    metric.tone === "attention"
                      ? cockpitColors.warning
                      : metric.tone === "good"
                        ? cockpitColors.handled
                        : cockpitColors.textMuted,
                }}
              >
                {scrubInternalWording(metric.detail)}
              </div>
            ) : null}
          </>
        );
        if (metric.href) {
          return (
            <Link
              key={metric.id}
              href={metric.href}
              className="vt-dash-card vt-dash-metric-interactive"
              style={{ padding: "16px", minHeight: 126 }}
            >
              {body}
            </Link>
          );
        }
        return (
          <div
            key={metric.id}
            className="vt-dash-card"
            style={{ padding: "16px", display: "grid", gap: 9, minHeight: 126 }}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}

function metricVisual(label: string, tone?: "default" | "attention" | "good") {
  const normalized = String(label).toLowerCase();
  if (tone === "attention" || /need|attention|waiting|approval/.test(normalized)) return { icon: CircleAlert, color: "#b45309", background: "#fff3dd" };
  if (/team|teammate|employee/.test(normalized)) return { icon: UsersRound, color: "#7c3aed", background: "#f1eaff" };
  if (/work|motion|active|deal|showing/.test(normalized)) return { icon: BriefcaseBusiness, color: "#047857", background: "#e5f7ef" };
  if (/inquir|lead|people|conversation|message/.test(normalized)) return { icon: Mail, color: "#2563eb", background: "#e8f1ff" };
  if (tone === "good" || /complete|win|outcome/.test(normalized)) return { icon: ClipboardCheck, color: "#059669", background: "#e5f7ef" };
  return { icon: BarChart3, color: "#0f766e", background: "#e4f7f3" };
}

export function DashGrid({ children }: { children: ReactNode }) {
  return <div className="vt-dash-grid-3">{children}</div>;
}

export function DashCard({
  title,
  count,
  action,
  children,
  accent,
}: {
  title: string;
  count?: number | null;
  action?: ReactNode;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className="vt-dash-card"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 280,
        overflow: "hidden",
        borderColor: accent ? "rgba(180, 83, 9, 0.22)" : undefined,
        boxShadow: accent
          ? "0 1px 2px rgba(180, 83, 9, 0.06), 0 8px 24px rgba(180, 83, 9, 0.06)"
          : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px 10px",
          borderBottom: `1px solid ${cockpitColors.panelBorder}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 700,
              color: cockpitColors.textPrimary,
              letterSpacing: "-0.01em",
            }}
          >
            {scrubInternalWording(title)}
          </h2>
          {typeof count === "number" && count > 0 ? (
            <span
              style={{
                minWidth: 22,
                height: 22,
                padding: "0 7px",
                borderRadius: radius.pill,
                background: accent ? cockpitColors.critical : cockpitColors.inset,
                color: accent ? "#fff" : cockpitColors.textSecondary,
                fontSize: 11,
                fontWeight: 750,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </div>
        {action}
      </div>
      <div style={{ padding: "4px 8px 12px", flex: 1, minHeight: 0, overflow: "auto" }}>
        {children}
      </div>
    </section>
  );
}

export function QuietLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={quietLinkStyle}>
      {children}
      <ArrowUpRight size={12} aria-hidden style={{ marginLeft: 2 }} />
    </Link>
  );
}

export function QueueRow({
  title,
  detail,
  priority,
  when,
  href,
  actionLabel = "Review",
}: {
  title: string;
  detail?: string | null;
  priority?: string | null;
  when?: string | null;
  href?: string | null;
  actionLabel?: string;
}) {
  const badge = priorityBadge(priority);
  const interactive = Boolean(href);
  const body = (
    <div
      className={interactive ? "vt-dash-row-interactive" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: badge ? "auto 1fr auto" : interactive ? "1fr auto" : "1fr",
        gap: 10,
        alignItems: "start",
        padding: "10px 8px",
        borderRadius: 10,
      }}
    >
      {badge ? (
        <span
          style={{
            marginTop: 2,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: badge.color,
            background: badge.bg,
            padding: "3px 6px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          {badge.label}
        </span>
      ) : null}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650, color: cockpitColors.textPrimary, lineHeight: 1.35 }}>
          {scrubInternalWording(title)}
        </div>
        {detail ? (
          <div style={{ marginTop: 2, fontSize: 12, color: cockpitColors.textMuted, lineHeight: 1.4 }}>
            {scrubInternalWording(detail)}
          </div>
        ) : null}
        {when ? (
          <div style={{ marginTop: 4, fontSize: 11, color: cockpitColors.textMuted }}>{when}</div>
        ) : null}
      </div>
      {interactive ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: 12,
            fontWeight: 700,
            color: cockpitColors.accent,
            whiteSpace: "nowrap",
            marginTop: 2,
            maxWidth: 88,
            overflow: "hidden",
            textOverflow: "ellipsis",
            flexShrink: 0,
          }}
        >
          {actionLabel}
          <ArrowRight size={12} aria-hidden style={{ flexShrink: 0 }} />
        </span>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function ActivityItem({
  title,
  meta,
  href,
  index = 0,
}: {
  title: string;
  meta?: string | null;
  href?: string | null;
  index?: number;
}) {
  const visuals = [
    { icon: Activity, color: "#2563eb", background: "#e8f1ff" },
    { icon: ClipboardCheck, color: "#d97706", background: "#fff3dd" },
    { icon: CheckCircle2, color: "#059669", background: "#e5f7ef" },
    { icon: UsersRound, color: "#7c3aed", background: "#f1eaff" },
    { icon: Mail, color: "#dc2626", background: "#ffe9e8" },
  ];
  const visual = visuals[index % visuals.length];
  const Icon = visual.icon;
  const interactive = Boolean(href);
  const body = (
    <div
      className={interactive ? "vt-dash-row-interactive" : undefined}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 8px",
        borderRadius: 10,
      }}
    >
      <span aria-hidden style={{ width: 31, height: 31, borderRadius: 10, background: visual.background, color: visual.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={16} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: cockpitColors.textPrimary, lineHeight: 1.35 }}>
          {scrubInternalWording(title)}
        </div>
        {meta ? (
          <div style={{ marginTop: 3, fontSize: 11, color: cockpitColors.textMuted }}>{scrubInternalWording(meta)}</div>
        ) : null}
      </div>
      {interactive ? (
        <ArrowRight size={12} aria-hidden style={{ marginTop: 4, color: cockpitColors.accent, flexShrink: 0 }} />
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function WorkforceRow({
  name,
  role,
  status,
  statusId,
  assignment,
  href,
  actionLabel = "Open",
}: {
  name: string;
  role?: string | null;
  status?: string | null;
  statusId?: string | null;
  assignment?: string | null;
  href?: string | null;
  actionLabel?: string | null;
}) {
  const needsAttention = statusId === "needs_approval" || /needs your approval/i.test(String(status ?? ""));
  const standingBy = statusId === "idle" || /standing by|idle/i.test(String(status ?? ""));
  const interactive = Boolean(href);
  const statusColor = needsAttention
    ? cockpitColors.warning
    : standingBy
      ? cockpitColors.textMuted
      : cockpitColors.handled;
  const initials = scrubInternalWording(name).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AI";

  const body = (
    <div
      className={interactive ? "vt-dash-row-interactive" : undefined}
      style={{
        padding: "10px 8px",
        borderRadius: 10,
        borderBottom: interactive ? undefined : `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 9, minWidth: 0 }}>
          <span aria-hidden style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "linear-gradient(135deg, #0f766e, #155e75)", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{initials}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: cockpitColors.textPrimary }}>
              {scrubInternalWording(name)}
            </div>
            {role ? (
              <div style={{ marginTop: 2, fontSize: 12, color: cockpitColors.textMuted }}>
                {scrubInternalWording(role)}
              </div>
            ) : null}
          </div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: statusColor, whiteSpace: "nowrap" }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: statusColor }} />
          {scrubInternalWording(status ?? (standingBy ? "Standing by" : "Active"))}
        </span>
      </div>
      {assignment ? (
        <div style={{ marginTop: 6, fontSize: 12, color: cockpitColors.textSecondary, lineHeight: 1.4 }}>
          {scrubInternalWording(assignment)}
        </div>
      ) : null}
      {interactive && actionLabel ? (
        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: 12,
            fontWeight: 700,
            color: cockpitColors.accent,
          }}
        >
          {actionLabel}
          <ArrowRight size={12} aria-hidden />
        </div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function SituationRow({
  title,
  detail,
  next,
  href,
  actionLabel = "Open",
}: {
  title: string;
  detail?: string | null;
  next?: string | null;
  href?: string | null;
  actionLabel?: string | null;
}) {
  const interactive = Boolean(href);
  const body = (
    <div
      className={interactive ? "vt-dash-row-interactive" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: interactive ? "1fr auto" : "1fr",
        gap: 10,
        padding: "10px 8px",
        borderRadius: 10,
        alignItems: "start",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 650 }}>{scrubInternalWording(title)}</div>
        {detail ? (
          <div style={{ marginTop: 3, fontSize: 12, color: cockpitColors.textSecondary }}>{scrubInternalWording(detail)}</div>
        ) : null}
        {next ? (
          <div style={{ marginTop: 3, fontSize: 11, color: cockpitColors.textMuted }}>
            Next: {scrubInternalWording(next)}
          </div>
        ) : null}
      </div>
      {interactive && actionLabel ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: 12,
            fontWeight: 700,
            color: cockpitColors.accent,
            whiteSpace: "nowrap",
            marginTop: 2,
          }}
        >
          {actionLabel}
          <ArrowRight size={12} aria-hidden />
        </span>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function CommRow({
  title,
  detail,
  status,
  when,
  href,
  actionLabel,
}: {
  title: string;
  detail?: string | null;
  status?: string | null;
  when?: string | null;
  href?: string | null;
  actionLabel?: string | null;
}) {
  const badge = statusBadge(status);
  const interactive = Boolean(href);
  const body = (
    <div
      className={interactive ? "vt-dash-row-interactive" : undefined}
      style={{
        display: "grid",
        gap: 4,
        padding: "10px 8px",
        borderRadius: 10,
        borderBottom: interactive ? undefined : `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 650 }}>{scrubInternalWording(title)}</div>
        {badge ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: badge.color,
              background: badge.bg,
              padding: "2px 6px",
              borderRadius: 6,
              height: "fit-content",
            }}
          >
            {badge.label}
          </span>
        ) : null}
      </div>
      {detail ? (
        <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>{scrubInternalWording(detail)}</div>
      ) : null}
      {when ? <div style={{ fontSize: 11, color: cockpitColors.textMuted }}>{when}</div> : null}
      {interactive && actionLabel ? (
        <div
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            fontSize: 12,
            fontWeight: 700,
            color: cockpitColors.accent,
          }}
        >
          {actionLabel}
          <ArrowRight size={12} aria-hidden />
        </div>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {body}
      </Link>
    );
  }
  return body;
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "12px 8px", color: cockpitColors.textMuted, fontSize: 13, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

export function AskCard({ children }: { children: ReactNode }) {
  return (
    <section className="vt-dash-card" style={{ padding: "14px 16px" }}>
      <div
        style={{
          marginBottom: 10,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cockpitColors.textMuted,
        }}
      >
        Ask VIBETech
      </div>
      {children}
    </section>
  );
}

function priorityBadge(priority?: string | null) {
  const raw = String(priority ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Skip tone labels ("neutral") — they read as product bugs and crowd the row.
  if (lower === "neutral" || lower === "none" || lower === "default") return null;
  if (/high|urgent|critical|warning/.test(lower)) {
    return { label: "High", color: "#b91c1c", bg: "rgba(185,28,28,0.1)" };
  }
  if (/medium|moderate/.test(lower)) {
    // Medium is the default for most items — omit badge to reduce chrome noise.
    return null;
  }
  if (/low/.test(lower)) {
    return { label: "Low", color: "#047857", bg: "rgba(4,120,87,0.1)" };
  }
  return null;
}

function statusBadge(status?: string | null) {
  const raw = String(status ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/sent|delivered|completed|done|active/.test(lower)) {
    return { label: scrubInternalWording(raw), color: "#047857", bg: "rgba(4,120,87,0.1)" };
  }
  if (/draft|pending|wait/.test(lower)) {
    return { label: scrubInternalWording(raw), color: "#78716c", bg: "rgba(120,113,108,0.12)" };
  }
  return { label: scrubInternalWording(raw), color: "#1d4ed8", bg: "rgba(29,78,216,0.1)" };
}

const quietLinkStyle: CSSProperties = {
  color: cockpitColors.accent,
  fontWeight: 650,
  fontSize: 12,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};
