"use client";

import Link from "next/link";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type ShellMetric = {
  id: string;
  label: string;
  value: string;
  href?: string | null;
};

export default function ShellMetricStrip({ metrics }: { metrics: ShellMetric[] }) {
  if (!metrics.length) return null;

  return (
    <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
      {metrics.slice(0, 5).map((metric) => {
        const content = (
          <div
            style={{
              padding: `${spacing.xs} ${spacing.sm}`,
              borderRadius: radius.medium,
              backgroundColor: cockpitColors.panelElevated,
              border: `1px solid ${cockpitColors.panelBorder}`,
              minWidth: 88,
            }}
          >
            <div style={{ fontSize: "0.65rem", color: cockpitColors.textMuted, lineHeight: 1.2 }}>{metric.label}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 650, color: cockpitColors.textPrimary }}>{metric.value}</div>
          </div>
        );

        return metric.href ? (
          <Link key={metric.id} href={metric.href} style={{ textDecoration: "none", color: "inherit" }}>
            {content}
          </Link>
        ) : (
          <div key={metric.id}>{content}</div>
        );
      })}
    </div>
  );
}
