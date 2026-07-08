"use client";

import Link from "next/link";

import OperatingMetricsRow, { type OperatingMetric } from "./OperatingMetricsRow";
import PortfolioIntelligenceTable, { type PortfolioPropertyRow } from "./PortfolioIntelligenceTable";
import { ProductPage, Section, EmptyState } from "@/components/product";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type OperatingActivityItem = {
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  href: string | null;
  subjectName?: string | null;
  partyName?: string | null;
};

export type OperatingAttentionItem = {
  id: string;
  title: string;
  summary: string;
  priority: string;
  href: string;
};

export type BusinessOperatingHomeView = {
  showOperatingDashboard: boolean;
  metrics: OperatingMetric[];
  topProperties: PortfolioPropertyRow[];
  recentActivity: OperatingActivityItem[];
  attention: OperatingAttentionItem[];
  unattributedInquiries: number;
  unattributedCallout: string | null;
  sections: {
    propertyIntelligence: string;
    recentActivity: string;
    attention: string;
  };
  portfolioTable: {
    property: string;
    inquiries: string;
    interested: string;
    followUps: string;
    latestActivity: string;
  };
  emptyStates: Record<string, string>;
};

function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActivityList({ items }: { items: OperatingActivityItem[] }) {
  return (
    <div style={{ display: "grid", gap: spacing.sm }}>
      {items.map((item) => {
        const content = (
          <div
            style={{
              padding: spacing.md,
              borderRadius: radius.large,
              border: `1px solid ${cockpitColors.panelBorder}`,
              backgroundColor: cockpitColors.panel,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{item.title}</div>
                {item.summary ? (
                  <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs, lineHeight: 1.5 }}>
                    {item.summary}
                  </div>
                ) : null}
                {item.partyName || item.subjectName ? (
                  <div style={{ ...typography.caption, color: cockpitColors.textMuted, marginTop: spacing.xs }}>
                    {[item.partyName, item.subjectName].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
              </div>
              <div style={{ ...typography.caption, color: cockpitColors.textMuted, whiteSpace: "nowrap" }}>
                {formatTimestamp(item.occurredAt)}
              </div>
            </div>
          </div>
        );

        return item.href ? (
          <Link key={item.id} href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
            {content}
          </Link>
        ) : (
          <div key={item.id}>{content}</div>
        );
      })}
    </div>
  );
}

export default function BusinessOperatingHomeLayout({ operating }: { operating: BusinessOperatingHomeView }) {
  if (!operating.showOperatingDashboard) return null;

  return (
    <ProductPage>
      <OperatingMetricsRow metrics={operating.metrics} />

      {operating.unattributedCallout ? (
        <div
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.large,
            border: `1px solid ${cockpitColors.panelBorder}`,
            backgroundColor: cockpitColors.panelElevated,
            ...typography.caption,
            color: cockpitColors.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {operating.unattributedCallout}
        </div>
      ) : null}

      <div style={{ marginTop: spacing.lg }}>
        <PortfolioIntelligenceTable
          title={operating.sections.propertyIntelligence}
          rows={operating.topProperties}
          columns={operating.portfolioTable}
          emptyDescription={operating.emptyStates.propertyIntelligence ?? "Add a property and receive an inquiry."}
        />
      </div>

      <Section title={operating.sections.recentActivity} noBorder>
        {operating.recentActivity.length === 0 ? (
          <EmptyState
            title="No recent activity"
            description={operating.emptyStates.recentActivity ?? "Activity will appear after your first inquiry."}
          />
        ) : (
          <ActivityList items={operating.recentActivity} />
        )}
      </Section>

      {operating.attention.length > 0 ? (
        <Section title={operating.sections.attention} noBorder>
          <div style={{ display: "grid", gap: spacing.sm }}>
            {operating.attention.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: spacing.md,
                  borderRadius: radius.large,
                  border: `1px solid ${cockpitColors.panelBorder}`,
                  backgroundColor: cockpitColors.panel,
                }}
              >
                <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{item.title}</div>
                {item.summary ? (
                  <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs, lineHeight: 1.5 }}>
                    {item.summary}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </ProductPage>
  );
}
