"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import ShellPanel from "@/components/shell/ShellPanel";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import PortfolioIntelligenceTable from "@/components/home/PortfolioIntelligenceTable";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";
import { isRegisteredWidget } from "@/lib/portal-renderer/registries.js";
import EmptyStateRenderer from "./EmptyStateRenderer";

type WidgetDef = {
  id: string;
  componentType: string;
  label: string;
  dataSource?: string | null;
};

type DashboardProjection = {
  metrics?: Array<{ id: string; label: string; value: string | number; hint?: string }>;
  attention?: Array<Record<string, unknown>>;
  workRows?: Array<Record<string, unknown>>;
  workforce?: Array<Record<string, unknown>>;
  subjects?: Array<Record<string, unknown>>;
  communications?: Array<Record<string, unknown>>;
  readiness?: { label?: string; reason?: string; tone?: string } | null;
  calendar?: Array<Record<string, unknown>>;
  pipeline?: Array<{ id: string; label: string; count?: number }>;
  activity?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  charts?: Array<{ id: string; label: string; value?: string | number }>;
  emptyStates?: Record<string, string>;
  sections?: Record<string, string>;
  portfolioTable?: unknown;
  businessId: string;
};

/**
 * Resolves a registered widget type to a known React implementation.
 * Switch/map only — never dynamic eval or generated components.
 */
export function resolveWidgetComponent(componentType: string) {
  if (!isRegisteredWidget(componentType)) return null;
  switch (componentType) {
    case "metric_cards":
      return MetricCardsWidget;
    case "attention_queue":
      return AttentionQueueWidget;
    case "work_queue":
      return WorkQueueWidget;
    case "digital_workforce":
      return DigitalWorkforceWidget;
    case "subject_summaries":
      return SubjectSummariesWidget;
    case "pipeline":
      return PipelineWidget;
    case "communication_summary":
      return CommunicationSummaryWidget;
    case "calendar_deadlines":
      return CalendarDeadlinesWidget;
    case "readiness":
      return ReadinessWidget;
    case "charts":
      return ChartsWidget;
    case "recent_activity":
      return RecentActivityWidget;
    case "operational_alerts":
      return OperationalAlertsWidget;
    default:
      return null;
  }
}

export default function DashboardRenderer({
  widgets,
  projection,
  title,
}: {
  widgets: WidgetDef[];
  projection: DashboardProjection;
  title?: string;
}) {
  const accepted = widgets.filter((widget) => isRegisteredWidget(widget.componentType));
  if (!accepted.length) {
    return (
      <EmptyStateRenderer
        title={title ?? "Dashboard"}
        description="No approved dashboard widgets are available for this Business OS yet."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.lg }}>
      {title ? (
        <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 650, color: cockpitColors.textPrimary }}>{title}</h1>
      ) : null}
      <div style={gridStyle}>
        {accepted.map((widget) => {
          const Component = resolveWidgetComponent(widget.componentType);
          if (!Component) return null;
          return (
            <div key={widget.id} style={spanFor(widget.componentType)}>
              <Component widget={widget} projection={projection} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function spanFor(type: string): CSSProperties {
  if (type === "metric_cards" || type === "subject_summaries") return { gridColumn: "1 / -1" };
  if (type === "pipeline" || type === "charts") return { gridColumn: "1 / -1" };
  return {};
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: spacing.md,
  alignItems: "start",
};

function MetricCardsWidget({ projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const metrics = projection.metrics ?? [];
  if (!metrics.length) {
    return <EmptyStateRenderer title="Metrics" description={projection.emptyStates?.metrics ?? "Metrics appear after operating activity."} compact />;
  }
  return <ShellMetricStrip metrics={metrics as never} />;
}

function AttentionQueueWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const items = projection.attention ?? [];
  const base = `/b/${projection.businessId}`;
  return (
    <ShellPanel
      title={widget.label || projection.sections?.attention || "Needs attention"}
      subtitle="Decisions only you can make"
      action={items.length ? <Link href={`${base}/for-you`} style={linkStyle}>View all</Link> : null}
    >
      {items.length === 0 ? (
        <EmptyStateRenderer
          title=""
          description={projection.emptyStates?.attention ?? "Nothing needs your judgment right now."}
          compact
        />
      ) : (
        items.slice(0, 4).map((item) => (
          <SimpleRow
            key={String(item.id)}
            title={String(item.title ?? "Attention item")}
            detail={String(item.summary ?? item.reason ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function WorkQueueWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const rows = projection.workRows ?? [];
  const base = `/b/${projection.businessId}`;
  return (
    <ShellPanel
      title={widget.label || projection.sections?.workInMotion || "Work"}
      subtitle="Open operating work"
      action={<Link href={`${base}/work`} style={linkStyle}>Open work</Link>}
    >
      {rows.length === 0 ? (
        <EmptyStateRenderer title="" description={projection.emptyStates?.work ?? "No open work."} compact />
      ) : (
        rows.slice(0, 5).map((row) => (
          <SimpleRow
            key={String(row.id)}
            title={String(row.title ?? row.label ?? "Work item")}
            detail={String(row.statusLabel ?? row.ownerLabel ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function DigitalWorkforceWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const employees = projection.workforce ?? [];
  const base = `/b/${projection.businessId}`;
  return (
    <ShellPanel
      title={widget.label || projection.sections?.digitalWorkforce || "Digital workforce"}
      subtitle="Always-on operators"
      action={<Link href={`${base}/team`} style={linkStyle}>Team</Link>}
    >
      {employees.length === 0 ? (
        <EmptyStateRenderer title="" description="No digital employees configured yet." compact />
      ) : (
        employees.slice(0, 5).map((employee) => (
          <SimpleRow
            key={String(employee.id ?? employee.name)}
            title={String(employee.name ?? employee.label ?? "Employee")}
            detail={String(employee.purpose ?? employee.statusLabel ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function SubjectSummariesWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const rows = (projection.subjects ?? []) as never;
  return (
    <PortfolioIntelligenceTable
      title={widget.label || projection.sections?.propertyIntelligence || "Portfolio"}
      rows={rows}
      columns={projection.portfolioTable as never}
      emptyDescription={projection.emptyStates?.propertyIntelligence ?? "Add your first record to see portfolio intelligence."}
    />
  );
}

function PipelineWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const stages = projection.pipeline ?? [];
  return (
    <ShellPanel title={widget.label || "Pipeline"} subtitle="Operating stages">
      {stages.length === 0 ? (
        <EmptyStateRenderer title="" description="Pipeline stages appear once work starts." compact />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stages.length, 5)}, minmax(0, 1fr))`, gap: spacing.sm }}>
          {stages.map((stage) => (
            <div key={stage.id} style={stageCard}>
              <div style={{ fontSize: 11, color: cockpitColors.textMuted, textTransform: "uppercase" }}>{stage.label}</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{stage.count ?? 0}</div>
            </div>
          ))}
        </div>
      )}
    </ShellPanel>
  );
}

function CommunicationSummaryWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const threads = projection.communications ?? [];
  return (
    <ShellPanel title={widget.label || projection.sections?.recentCommunications || "Communications"}>
      {threads.length === 0 ? (
        <EmptyStateRenderer title="" description="No recent communications." compact />
      ) : (
        threads.slice(0, 5).map((thread) => (
          <SimpleRow
            key={String(thread.id)}
            title={String(thread.subject ?? "Thread")}
            detail={String(thread.preview ?? "")}
            href={thread.href ? String(thread.href) : null}
          />
        ))
      )}
    </ShellPanel>
  );
}

function CalendarDeadlinesWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const items = projection.calendar ?? [];
  return (
    <ShellPanel title={widget.label || "Schedule"} subtitle="Upcoming deadlines">
      {items.length === 0 ? (
        <EmptyStateRenderer title="" description="No upcoming deadlines." compact />
      ) : (
        items.slice(0, 5).map((item) => (
          <SimpleRow
            key={String(item.id ?? item.label)}
            title={String(item.title ?? item.label ?? "Event")}
            detail={String(item.whenLabel ?? item.date ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function ReadinessWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const readiness = projection.readiness;
  return (
    <ShellPanel title={widget.label || "Readiness"}>
      {readiness ? (
        <div style={{ padding: spacing.md }}>
          <div style={{ fontWeight: 650 }}>{readiness.label ?? "Status"}</div>
          <div style={{ marginTop: 6, color: cockpitColors.textSecondary, fontSize: typography.caption.fontSize }}>{readiness.reason}</div>
        </div>
      ) : (
        <EmptyStateRenderer title="" description="Readiness appears after setup." compact />
      )}
    </ShellPanel>
  );
}

function ChartsWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const charts = projection.charts ?? projection.metrics ?? [];
  return (
    <ShellPanel title={widget.label || "Trends"}>
      {charts.length === 0 ? (
        <EmptyStateRenderer title="" description="Trends appear after operating activity." compact />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: spacing.sm, padding: spacing.md }}>
          {charts.slice(0, 6).map((chart) => (
            <div key={String(chart.id ?? chart.label)} style={stageCard}>
              <div style={{ fontSize: 12, color: cockpitColors.textMuted }}>{String(chart.label)}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{String(chart.value ?? "—")}</div>
            </div>
          ))}
        </div>
      )}
    </ShellPanel>
  );
}

function RecentActivityWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const activity = projection.activity ?? [];
  return (
    <ShellPanel title={widget.label || "Recent activity"}>
      {activity.length === 0 ? (
        <EmptyStateRenderer title="" description="Activity will show here as the business operates." compact />
      ) : (
        activity.slice(0, 5).map((item) => (
          <SimpleRow
            key={String(item.id)}
            title={String(item.title ?? item.label ?? "Activity")}
            detail={String(item.summary ?? item.detail ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function OperationalAlertsWidget({ widget, projection }: { widget: WidgetDef; projection: DashboardProjection }) {
  const alerts = projection.alerts ?? projection.attention ?? [];
  return (
    <ShellPanel title={widget.label || "Operational alerts"}>
      {alerts.length === 0 ? (
        <EmptyStateRenderer title="" description="No operational alerts." compact />
      ) : (
        alerts.slice(0, 5).map((item) => (
          <SimpleRow
            key={String(item.id)}
            title={String(item.title ?? "Alert")}
            detail={String(item.summary ?? item.reason ?? "")}
          />
        ))
      )}
    </ShellPanel>
  );
}

function SimpleRow({ title, detail, href }: { title: string; detail?: string; href?: string | null }) {
  const body = (
    <div style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
      <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{title}</div>
      {detail ? <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{detail}</div> : null}
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{body}</Link>;
  return body;
}

const linkStyle: CSSProperties = {
  fontSize: typography.caption.fontSize,
  color: cockpitColors.accent,
  textDecoration: "none",
};

const stageCard: CSSProperties = {
  padding: spacing.md,
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  backgroundColor: cockpitColors.panel,
};
