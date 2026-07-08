"use client";

import Link from "next/link";

import MetricCard from "@/components/executive/MetricCard";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export type OperatingMetric = {
  id: string;
  label: string;
  value: string;
  href: string;
};

export default function OperatingMetricsRow({ metrics }: { metrics: OperatingMetric[] }) {
  if (!metrics.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: spacing.md,
      }}
    >
      {metrics.map((metric) => (
        <Link key={metric.id} href={metric.href} style={{ textDecoration: "none", color: "inherit" }}>
          <MetricCard title={metric.label} value={metric.value} />
        </Link>
      ))}
    </div>
  );
}
