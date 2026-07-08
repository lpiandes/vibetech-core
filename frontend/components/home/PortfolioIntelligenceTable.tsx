"use client";

import Link from "next/link";

import { Section, EmptyState } from "@/components/product";
import StatusBadge from "@/components/product/StatusBadge";
import type { StatusBadgeTone } from "@/components/product/StatusBadge";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export type PortfolioPropertyRow = {
  subjectId: string;
  displayName: string;
  status: string;
  address: string | null;
  inquiryCount: number;
  interestedCount: number;
  openFollowUpCount: number;
  latestActivityAt: string | null;
  href: string;
};

function statusTone(status: string): StatusBadgeTone {
  if (status === "active") return "success";
  if (status === "archived" || status === "inactive") return "warning";
  return "neutral";
}

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

export default function PortfolioIntelligenceTable({
  title,
  rows,
  columns,
  emptyDescription,
}: {
  title: string;
  rows: PortfolioPropertyRow[];
  columns: {
    property: string;
    inquiries: string;
    interested: string;
    followUps: string;
    latestActivity: string;
  };
  emptyDescription: string;
}) {
  return (
    <Section title={title} noBorder>
      {rows.length === 0 ? (
        <EmptyState title="No property intelligence yet" description={emptyDescription} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                {[columns.property, columns.inquiries, columns.interested, columns.followUps, columns.latestActivity].map(
                  (label) => (
                    <th
                      key={label}
                      style={{
                        textAlign: "left",
                        padding: `${spacing.sm} ${spacing.md}`,
                        borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                        ...typography.caption,
                        color: cockpitColors.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.subjectId}>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                    <Link href={row.href} style={{ textDecoration: "none", color: cockpitColors.textPrimary }}>
                      <div style={{ fontWeight: 650 }}>{row.displayName}</div>
                      {row.address ? (
                        <div style={{ ...typography.caption, color: cockpitColors.textMuted, marginTop: 2 }}>{row.address}</div>
                      ) : null}
                      <div style={{ marginTop: spacing.xs }}>
                        <StatusBadge label={row.status} tone={statusTone(row.status)} />
                      </div>
                    </Link>
                  </td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                    {row.inquiryCount}
                  </td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                    {row.interestedCount}
                  </td>
                  <td style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                    {row.openFollowUpCount}
                  </td>
                  <td
                    style={{
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                      ...typography.caption,
                      color: cockpitColors.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTimestamp(row.latestActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
