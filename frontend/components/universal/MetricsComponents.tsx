"use client";

import { UcBadge, UcGrid, UcHost, UcRow, type UniversalChromeProps } from "./chrome";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

type Item = Record<string, any>;

function itemsOf(props: UniversalChromeProps & { items?: Item[] }) {
  return Array.isArray(props.items) ? props.items : [];
}

export function MetricCards(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="metric_cards" empty={!items.length} emptyTitle="No metrics yet" emptyDescription="Metrics appear after operating activity.">
      <UcGrid min={140}>
        {items.map((item) => (
          <div key={String(item.id ?? item.label)} style={metricCard(props.dark)}>
            <div style={muted(props.dark)}>{String(item.label ?? "Metric")}</div>
            <div style={metricValue(props.dark)}>{String(item.value ?? "—")}</div>
            {item.hint ? <div style={{ ...muted(props.dark), marginTop: 4 }}>{String(item.hint)}</div> : null}
          </div>
        ))}
      </UcGrid>
    </UcHost>
  );
}

export function KpiCards(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="kpi_cards" empty={!items.length} emptyTitle="No KPIs" emptyDescription="KPIs appear once targets are configured.">
      <UcGrid min={160}>
        {items.map((item) => (
          <div key={String(item.id ?? item.label)} style={metricCard(props.dark)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={muted(props.dark)}>{String(item.label ?? "KPI")}</span>
              <UcBadge tone={item.tone ?? "accent"} dark={props.dark}>{String(item.delta ?? "—")}</UcBadge>
            </div>
            <div style={metricValue(props.dark)}>{String(item.value ?? "—")}</div>
          </div>
        ))}
      </UcGrid>
    </UcHost>
  );
}

export function InsightCards(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="insight_cards" empty={!items.length} emptyTitle="No insights" emptyDescription="Insights appear as the business operates.">
      {items.slice(0, 6).map((item) => (
        <UcRow
          key={String(item.id ?? item.title)}
          title={String(item.title ?? item.label ?? "Insight")}
          detail={String(item.summary ?? item.detail ?? "")}
          dark={props.dark}
          meta={<UcBadge tone="accent" dark={props.dark}>Insight</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function AiRecommendationCards(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="ai_recommendation_cards" empty={!items.length} emptyTitle="No recommendations" emptyDescription="Recommendations appear when Architect or employees suggest next steps.">
      {items.slice(0, 5).map((item) => (
        <UcRow
          key={String(item.id ?? item.title)}
          title={String(item.title ?? "Recommendation")}
          detail={String(item.reason ?? item.summary ?? "")}
          dark={props.dark}
          meta={<UcBadge tone="accent" dark={props.dark}>AI</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

export function Charts(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="charts" empty={!items.length} emptyTitle="No chart data" emptyDescription="Trends appear after operating activity.">
      <UcGrid min={120}>
        {items.slice(0, 8).map((item) => {
          const value = Number(item.value ?? 0);
          const max = Math.max(...items.map((entry) => Number(entry.value ?? 0)), 1);
          const height = Math.max(8, Math.round((value / max) * 72));
          return (
            <div key={String(item.id ?? item.label)} style={{ textAlign: "center" }}>
              <div style={{
                height: 80,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                marginBottom: 8,
              }}>
                <div style={{
                  width: "70%",
                  height,
                  borderRadius: 8,
                  background: props.dark ? "#14B8A6" : cockpitColors.accent,
                  opacity: 0.85,
                }} />
              </div>
              <div style={muted(props.dark)}>{String(item.label ?? "")}</div>
              <div style={{ fontWeight: 650, color: props.dark ? "#F8FAFC" : cockpitColors.textPrimary }}>{String(item.value ?? "—")}</div>
            </div>
          );
        })}
      </UcGrid>
    </UcHost>
  );
}

export function Reports(props: UniversalChromeProps & { items?: Item[] }) {
  const items = itemsOf(props);
  return (
    <UcHost {...props} componentType="reports" empty={!items.length} emptyTitle="No reports" emptyDescription="Reports appear once analytics are available.">
      {items.map((item) => (
        <UcRow
          key={String(item.id ?? item.title)}
          title={String(item.title ?? item.label ?? "Report")}
          detail={String(item.summary ?? "")}
          href={item.href ? String(item.href) : null}
          dark={props.dark}
          meta={<UcBadge dark={props.dark}>{String(item.status ?? "Ready")}</UcBadge>}
        />
      ))}
    </UcHost>
  );
}

function metricCard(dark?: boolean) {
  return {
    borderRadius: radius.large,
    border: `1px solid ${dark ? "rgba(148,163,184,.14)" : cockpitColors.panelBorder}`,
    background: dark ? "rgba(15,23,42,.55)" : cockpitColors.panelElevated,
    padding: spacing.md,
  } as const;
}

function metricValue(dark?: boolean) {
  return {
    marginTop: 8,
    fontSize: "1.45rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: dark ? "#F8FAFC" : cockpitColors.textPrimary,
  } as const;
}

function muted(dark?: boolean) {
  return {
    fontSize: typography.caption.fontSize,
    color: dark ? "rgba(226,232,240,.62)" : cockpitColors.textMuted,
  } as const;
}
