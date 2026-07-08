"use client";

import { useContext } from "react";

import { AnalyticsViewModelContext } from "./AnalyticsContext";
import { ProductPage, PageHeader, Section, EmptyState } from "@/components/product";
import { cockpitColors, spacing, typography } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

export default function AnalyticsExecutiveLayout() {
  const vm = useContext(AnalyticsViewModelContext);
  const kpis = safeArray(vm?.kpis);
  const insights = safeArray(vm?.insights);
  const hasMeaningfulData = kpis.some((k: any) => Number(k?.value ?? 0) > 0) || insights.length > 0;

  return (
    <ProductPage>
      <PageHeader title="Performance" />

      {!hasMeaningfulData ? (
        <EmptyState
          title="No performance data yet"
          description="Metrics will appear once your business handles inquiries, completes work, and sends communications."
        />
      ) : (
        <>
          {kpis.length > 0 ? (
            <Section title="Key measures">
              {kpis.slice(0, 8).map((kpi: any, index: number) => (
                <div
                  key={String(kpi.kpiId ?? kpi.id)}
                  style={{
                    padding: `${spacing.sm} ${spacing.lg}`,
                    borderBottom: index < Math.min(kpis.length, 8) - 1 ? `1px solid ${cockpitColors.panelBorder}` : undefined,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: spacing.md,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{String(kpi.name ?? kpi.kpiId)}</div>
                  </div>
                  <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>
                    {String(kpi.value ?? 0)}
                    {kpi.unit ? ` ${kpi.unit}` : ""}
                  </div>
                </div>
              ))}
            </Section>
          ) : null}

          {insights.length > 0 ? (
            <Section title="Insights">
              {insights.slice(0, 6).map((ins: any, index: number) => (
                <div
                  key={String(ins.insightId ?? ins.id)}
                  style={{
                    padding: `${spacing.sm} ${spacing.lg}`,
                    borderBottom: index < Math.min(insights.length, 6) - 1 ? `1px solid ${cockpitColors.panelBorder}` : undefined,
                  }}
                >
                  <div style={{ fontWeight: 600, color: cockpitColors.textPrimary }}>{String(ins.title ?? "")}</div>
                  <div style={{ marginTop: 2, fontSize: typography.caption.fontSize, color: cockpitColors.textSecondary }}>
                    {String(ins.message ?? "")}
                  </div>
                </div>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </ProductPage>
  );
}
