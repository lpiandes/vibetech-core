"use client";

import Link from "next/link";
import { Activity, CheckCircle2, CircleAlert, FileText, ListChecks, PlugZap, UsersRound } from "lucide-react";

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: spacing.sm }}>
      {metrics.slice(0, 5).map((metric) => {
        const visual = metricVisual(metric.label);
        const Icon = visual.icon;
        const content = (
          <div
            style={{
              minHeight: 92,
              padding: spacing.md,
              borderRadius: 14,
              backgroundColor: cockpitColors.panel,
              border: "1px solid #e8edf2",
              boxShadow: "0 6px 16px rgba(15,23,42,.035)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", background: visual.background, color: visual.color, flexShrink: 0 }}><Icon size={18} /></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: cockpitColors.textMuted, lineHeight: 1.2 }}>{metric.label}</span>
              <span style={{ display: "block", marginTop: 6, fontSize: "1.45rem", fontWeight: 750, letterSpacing: "-.035em", color: cockpitColors.textPrimary }}>{metric.value}</span>
            </span>
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

function metricVisual(label: string) {
  const value = label.toLowerCase();
  if (/need|blocked|overdue|attention|setup/.test(value)) return { icon: CircleAlert, color: "#c2410c", background: "#fff0df" };
  if (/ready|connected|complete|sent|working/.test(value)) return { icon: CheckCircle2, color: "#047857", background: "#e5f7ef" };
  if (/team|people|employee/.test(value)) return { icon: UsersRound, color: "#7c3aed", background: "#f1eaff" };
  if (/knowledge|document/.test(value)) return { icon: FileText, color: "#2563eb", background: "#e8f1ff" };
  if (/connection|integration/.test(value)) return { icon: PlugZap, color: "#0891b2", background: "#ecfeff" };
  if (/work|queue|open/.test(value)) return { icon: ListChecks, color: "#2563eb", background: "#e8f1ff" };
  return { icon: Activity, color: "#0891b2", background: "#ecfeff" };
}
