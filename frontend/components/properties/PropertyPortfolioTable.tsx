"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import EntityAvatar from "@/components/shell/EntityAvatar";
import StatusBadge from "@/components/product/StatusBadge";
import type { StatusBadgeTone } from "@/components/product/StatusBadge";
import ShellPanel from "@/components/shell/ShellPanel";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export type PropertyPortfolioRow = {
  subjectId: string;
  displayName: string;
  subjectType: string;
  status: string;
  address: string | null;
  inquiryCount: number;
  openInquiryCount: number;
  interestedCount: number;
  openFollowUpCount: number;
  overdueFollowUpCount: number;
  latestActivityAt: string | null;
  href: string | null;
};

function statusTone(status: string): StatusBadgeTone {
  if (status === "active") return "success";
  if (status === "archived" || status === "inactive") return "warning";
  return "neutral";
}

export function formatPortfolioTimestamp(iso: string | null | undefined) {
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

function RowSignals({ row }: { row: PropertyPortfolioRow }) {
  const signals: Array<{ label: string; tone: StatusBadgeTone }> = [];
  if (row.status !== "active") {
    signals.push({ label: row.status.replace(/_/g, " "), tone: statusTone(row.status) });
  }
  if (row.overdueFollowUpCount > 0) {
    signals.push({
      label: `${row.overdueFollowUpCount} overdue`,
      tone: "warning",
    });
  } else if (row.openInquiryCount > 0) {
    signals.push({
      label: `${row.openInquiryCount} open ${row.openInquiryCount === 1 ? "inquiry" : "inquiries"}`,
      tone: "neutral",
    });
  }

  if (!signals.length) return null;

  return (
    <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs }}>
      {signals.map((signal) => (
        <StatusBadge key={signal.label} label={signal.label} tone={signal.tone} />
      ))}
    </div>
  );
}

export default function PropertyPortfolioTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: PropertyPortfolioRow[];
  columns: {
    property: string;
    inquiries: string;
    interested: string;
    followUps: string;
    latestActivity: string;
  };
}) {
  const router = useRouter();

  return (
    <ShellPanel title={title}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {[columns.property, columns.inquiries, columns.interested, columns.followUps, columns.latestActivity, ""].map(
                (label, index) => (
                  <th
                    key={`${label}-${index}`}
                    style={{
                      textAlign: "left",
                      padding: `${spacing.sm} ${spacing.md}`,
                      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                      ...typography.caption,
                      color: cockpitColors.textMuted,
                      fontWeight: 600,
                      width: label === "" ? 40 : undefined,
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
              <tr
                key={row.subjectId}
                onClick={() => row.href && router.push(row.href)}
                style={{
                  cursor: row.href ? "pointer" : "default",
                }}
                onMouseEnter={(e) => {
                  if (row.href) e.currentTarget.style.backgroundColor = cockpitColors.panelElevated;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <td style={{ padding: `${spacing.sm} ${spacing.md}`, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                  <div style={{ display: "flex", gap: spacing.sm, alignItems: "flex-start" }}>
                    <EntityAvatar name={row.displayName} kind="subject" />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{row.displayName}</div>
                      {row.address ? (
                        <div style={{ ...typography.caption, color: cockpitColors.textMuted, marginTop: 2 }}>{row.address}</div>
                      ) : null}
                      <RowSignals row={row} />
                    </div>
                  </div>
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
                  {formatPortfolioTimestamp(row.latestActivityAt)}
                </td>
                <td
                  style={{
                    padding: `${spacing.sm} ${spacing.md}`,
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                    color: cockpitColors.textMuted,
                  }}
                >
                  {row.href ? <ArrowRight size={16} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ShellPanel>
  );
}
