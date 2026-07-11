"use client";

import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import StatusBadge from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import {
  MetricCards,
  KpiCards,
  Charts,
  Reports,
  InsightCards,
  StatusBadges,
  DataGrid,
  Tables,
} from "@/components/universal";

type AnalyticsView = {
  hasAnalytics: boolean;
  role?: string;
  kpis: Array<{
    id: string;
    label: string;
    availability: string;
    value: number | null;
    unit?: string | null;
    trend?: string | null;
    confidence?: number;
    freshness?: string | null;
    unavailableReason?: string | null;
    calculation?: string | null;
    drillDown?: Array<{ id: string; label?: string }>;
  }>;
  missing: Array<{ id: string; label: string; unavailableReason?: string | null; availability: string }>;
  alerts: Array<{ id: string; label: string; level: string; action?: string }>;
  reports: Array<{ id: string; label: string; description?: string; exportable?: boolean }>;
  definitions: Array<{ id: string; label: string; category: string; description?: string; sourceRuntime?: string }>;
  honesty?: { fabricatedMetricsForbidden?: boolean };
  metrics: Array<{ id: string; label: string; value: string | number }>;
};

function formatValue(entry: AnalyticsView["kpis"][number]) {
  if (entry.value == null) return "—";
  if (entry.unit === "ratio") return `${Math.round(Number(entry.value) * 100)}%`;
  if (entry.unit === "hours") return `${Number(entry.value).toFixed(1)}h`;
  return String(entry.value);
}

/**
 * Analytics / Performance workspace — KPIs, trends, alerts, reports, evidence.
 * Never shows fabricated metrics; missing data gets guidance instead of fake zeros.
 */
export default function AnalyticsWorkspace({ analytics }: { analytics: AnalyticsView }) {
  if (!analytics?.hasAnalytics) {
    return (
      <ShellPanel title="Analytics" subtitle="KPIs">
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, lineHeight: 1.5 }}>
          Architect will recommend what to measure. KPIs appear only from real operating evidence.
        </div>
      </ShellPanel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <ShellMetricStrip metrics={analytics.metrics as never} />

      <ShellPanel title="Business health" subtitle={`Role: ${analytics.role ?? "OWNER"}`}>
        <MetricCards items={analytics.kpis.slice(0, 6).map((entry) => ({
          id: entry.id,
          label: entry.label,
          value: formatValue(entry),
          hint: entry.freshness ? `Freshness ${entry.freshness}` : entry.calculation ?? undefined,
        }))} />
      </ShellPanel>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Important KPIs" subtitle="From canonical evidence">
          <KpiCards items={analytics.kpis.slice(0, 8).map((entry) => ({
            id: entry.id,
            label: entry.label,
            value: formatValue(entry),
            hint: entry.trend ? `Trend ${entry.trend}` : undefined,
          }))} />
        </ShellPanel>

        <ShellPanel title="Trends" subtitle="Registered chart widget">
          <Charts items={analytics.kpis.slice(0, 6).map((entry) => ({
            id: entry.id,
            label: entry.label,
            value: entry.value ?? 0,
          }))} />
        </ShellPanel>

        <ShellPanel title="Alerts" subtitle="Recommend action — never silent Work">
          {analytics.alerts.length ? analytics.alerts.map((alert) => (
            <div key={alert.id} style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: `${spacing.xs}px 0`,
              borderBottom: `1px solid ${cockpitColors.panelBorder}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm }}>
                <span>{alert.label}</span>
                <StatusBadge label={alert.level} tone={alert.level === "critical" ? "warning" : "warning"} />
              </div>
              <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>{alert.action}</div>
            </div>
          )) : (
            <div style={{ color: cockpitColors.textMuted }}>No alerts from current evidence.</div>
          )}
        </ShellPanel>
      </div>

      <ShellPanel title="Reports" subtitle="Saved · exportable definitions">
        <Reports items={analytics.reports.map((report) => ({
          id: report.id,
          label: report.label,
          summary: report.description,
        }))} />
      </ShellPanel>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: spacing.md,
      }}>
        <ShellPanel title="Drill-down evidence" subtitle="Canonical sources">
          <InsightCards items={analytics.kpis.flatMap((entry) => (
            (entry.drillDown ?? []).slice(0, 2).map((item) => ({
              id: `${entry.id}_${item.id}`,
              label: item.label ?? item.id,
              summary: entry.label,
            }))
          )).slice(0, 8)} />
        </ShellPanel>

        <ShellPanel title="Metric definitions" subtitle="What we measure">
          <Tables
            items={analytics.definitions.map((entry) => ({
              id: entry.id,
              name: entry.label,
              category: entry.category,
              source: entry.sourceRuntime ?? "",
            }))}
            columns={[
              { id: "name", label: "Metric" },
              { id: "category", label: "Category" },
              { id: "source", label: "Source" },
            ]}
          />
        </ShellPanel>

        <ShellPanel title="Needs data / setup" subtitle="Not fake zeros">
          <StatusBadges items={analytics.missing.slice(0, 8).map((entry) => ({
            id: entry.id,
            label: `${entry.label}: ${entry.availability.replace(/_/g, " ")}`,
          }))} />
          <DataGrid
            items={analytics.missing.slice(0, 8).map((entry) => ({
              id: entry.id,
              label: entry.label,
              status: entry.unavailableReason ?? entry.availability,
            }))}
            columns={[
              { id: "label", label: "Metric" },
              { id: "status", label: "Guidance" },
            ]}
          />
        </ShellPanel>
      </div>

      {analytics.honesty?.fabricatedMetricsForbidden ? (
        <div style={{ color: cockpitColors.textMuted, fontSize: typography.caption.fontSize }}>
          Fabricated metrics are forbidden. Revenue and engagement vanity metrics stay hidden until verified evidence exists.
        </div>
      ) : null}
    </div>
  );
}
