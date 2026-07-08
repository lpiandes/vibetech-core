"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import StatusBadge from "@/components/product/StatusBadge";
import SecondaryButton from "@/components/product/SecondaryButton";
import EntityAvatar from "@/components/shell/EntityAvatar";
import ShellMetricStrip from "@/components/shell/ShellMetricStrip";
import ShellPanel from "@/components/shell/ShellPanel";
import MaintenanceRequestDialog from "@/components/properties/MaintenanceRequestDialog";
import { formatPortfolioTimestamp } from "@/components/properties/PropertyPortfolioTable";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import type { StatusBadgeTone } from "@/components/product/StatusBadge";

export type SubjectOperatingDetail = {
  metrics: {
    inquiryCount: number;
    openInquiryCount: number;
    interestedCount: number;
    openFollowUpCount: number;
    overdueFollowUpCount: number;
    latestActivityAt: string | null;
  };
  recentInquiries: Array<{
    id: string;
    title: string;
    requestTypeLabel: string;
    status: string;
    receivedAt: string | null;
    partyName: string | null;
    sourceLabel: string | null;
    isOpen: boolean;
  }>;
  openWork: Array<{
    id: string;
    title: string;
    workTypeLabel: string;
    status: string;
    dueLabel: string | null;
    overdue: boolean;
    partyName: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    summary: string;
    occurredAt: string;
    requestId: string | null;
    partyName: string | null;
  }>;
  sectionLabels?: Record<string, string>;
  generatedAt: string;
};

export type SubjectAudiencePreview = {
  subject: {
    id: string;
    displayName: string;
    subjectType: string;
    status: string;
    address: string | null;
  };
  audience: {
    criteria: unknown[];
    explanation: string;
    totalCount: number;
    members: Array<{
      partyId: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      subjectDisplayName: string;
      firstInterestAt: string | null;
      lastActivityAt: string | null;
      sourceLabel: string | null;
      latestOutcome: string | null;
      latestOutcomeLabel: string | null;
      latestRequestId: string | null;
      evidence: Array<{
        type: string;
        label: string;
        occurredAt: string | null;
        requestId: string | null;
        interactionId: string | null;
      }>;
    }>;
  };
  generatedAt: string;
};

export type PropertyDetailPresentation = {
  detailMetrics: Record<string, string>;
  subjectTypeLabels: Record<string, string>;
};

function statusTone(status: string): StatusBadgeTone {
  if (status === "active") return "success";
  if (status === "archived") return "warning";
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

function subjectTypeLabel(subjectType: string, labels: Record<string, string>) {
  return labels[subjectType] ?? subjectType.replace(/_/g, " ");
}

function addressesMatch(displayName: string, address: string | null) {
  if (!address) return false;
  return displayName.trim().toLowerCase() === address.trim().toLowerCase();
}

function PanelEmpty({ description }: { description: string }) {
  return (
    <div
      style={{
        padding: spacing.md,
        color: cockpitColors.textMuted,
        fontSize: typography.caption.fontSize,
        lineHeight: 1.5,
      }}
    >
      {description}
    </div>
  );
}

export default function PropertyDetailLayout({
  businessId,
  preview,
  operatingDetail,
  presentation,
}: {
  businessId: string;
  preview: SubjectAudiencePreview;
  operatingDetail: SubjectOperatingDetail | null;
  presentation: PropertyDetailPresentation;
}) {
  const { subject, audience } = preview;
  const labels = operatingDetail?.sectionLabels ?? {};
  const detailMetrics = presentation.detailMetrics ?? {};
  const subjectTypeLabels = presentation.subjectTypeLabels ?? {};
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const canReportMaintenance = subject.status === "active";

  const showAddressLine = subject.address && !addressesMatch(subject.displayName, subject.address);
  const typeLabel = subjectTypeLabel(subject.subjectType, subjectTypeLabels);

  const metricsStrip =
    operatingDetail?.metrics
      ? [
          {
            id: "inquiries",
            label: detailMetrics.inquiries ?? "Inquiries",
            value: String(operatingDetail.metrics.inquiryCount),
          },
          {
            id: "interested",
            label: detailMetrics.interested ?? "Interested prospects",
            value: String(operatingDetail.metrics.interestedCount),
          },
          {
            id: "open_follow_ups",
            label: detailMetrics.openFollowUps ?? "Open follow-ups",
            value: String(operatingDetail.metrics.openFollowUpCount),
          },
          {
            id: "latest_activity",
            label: detailMetrics.latestActivity ?? "Latest activity",
            value: formatPortfolioTimestamp(operatingDetail.metrics.latestActivityAt),
          },
        ]
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.xl }}>
      <Link
        href={`/b/${businessId}/properties`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: cockpitColors.textMuted,
          textDecoration: "none",
          fontSize: typography.caption.fontSize,
          width: "fit-content",
        }}
      >
        <ArrowLeft size={14} />
        Properties
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: spacing.md,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: spacing.md, alignItems: "flex-start", minWidth: 0 }}>
          <EntityAvatar name={subject.displayName} kind="subject" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: typography.sectionTitle.fontSize, color: cockpitColors.textPrimary }}>
              {subject.displayName}
            </div>
            {showAddressLine ? (
              <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs }}>
                {subject.address}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                flexWrap: "wrap",
                marginTop: spacing.sm,
              }}
            >
              <StatusBadge label={subject.status} tone={statusTone(subject.status)} />
              <span style={{ ...typography.caption, color: cockpitColors.textMuted }}>{typeLabel}</span>
            </div>
          </div>
        </div>
        {canReportMaintenance ? (
          <SecondaryButton type="button" onClick={() => setMaintenanceOpen(true)}>
            Report maintenance issue
          </SecondaryButton>
        ) : null}
      </div>

      {maintenanceOpen ? (
        <MaintenanceRequestDialog
          businessId={businessId}
          subjectId={subject.id}
          propertyName={subject.displayName}
          onClose={() => setMaintenanceOpen(false)}
        />
      ) : null}

      {metricsStrip.length > 0 ? <ShellMetricStrip metrics={metricsStrip} /> : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: spacing.md,
          alignItems: "start",
        }}
      >
        <ShellPanel
          title="Interested people"
          subtitle={`${audience.totalCount} ${audience.totalCount === 1 ? "person" : "people"} · ${audience.explanation}`}
        >
          {audience.members.length === 0 ? (
            <PanelEmpty description="People appear here when they submit an inquiry or otherwise express interest in this property." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {audience.members.map((member) => (
                <div
                  key={member.partyId}
                  style={{
                    padding: spacing.md,
                    borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>
                        {member.displayName}
                      </div>
                      {member.email ? (
                        <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs }}>
                          {member.email}
                          {member.phone ? ` · ${member.phone}` : ""}
                        </div>
                      ) : null}
                    </div>
                    {member.latestRequestId ? (
                      <Link
                        href={`/b/${businessId}/inbox/ct_ack_${member.latestRequestId}`}
                        style={{
                          ...typography.caption,
                          color: cockpitColors.accent,
                          textDecoration: "none",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        View inquiry
                      </Link>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: spacing.sm,
                      marginTop: spacing.sm,
                    }}
                  >
                    <Meta label="Last activity" value={formatTimestamp(member.lastActivityAt)} />
                    <Meta label="Source" value={member.sourceLabel ?? "—"} />
                    <Meta label="Latest outcome" value={member.latestOutcomeLabel ?? "—"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ShellPanel>

        {operatingDetail ? (
          <ShellPanel title={labels.recentInquiries ?? "Recent requests"}>
            {operatingDetail.recentInquiries.length === 0 ? (
              <PanelEmpty description={labels.noInquiries ?? "No requests for this property yet."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {operatingDetail.recentInquiries.map((inquiry) => (
                  <Link
                    key={inquiry.id}
                    href={`/b/${businessId}/inbox/ct_ack_${inquiry.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: spacing.md,
                      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{inquiry.title}</div>
                        <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs }}>
                          {inquiry.partyName ?? "Unknown contact"}
                          {inquiry.sourceLabel ? ` · ${inquiry.sourceLabel}` : ""}
                        </div>
                      </div>
                      <div style={{ ...typography.caption, color: cockpitColors.textMuted, whiteSpace: "nowrap" }}>
                        {formatTimestamp(inquiry.receivedAt)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ShellPanel>
        ) : null}

        {operatingDetail ? (
          <ShellPanel title={labels.openWork ?? "Open work"}>
            {operatingDetail.openWork.length === 0 ? (
              <PanelEmpty description={labels.noOpenWork ?? "No open work for this property yet."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {operatingDetail.openWork.map((work) => (
                  <Link
                    key={work.id}
                    href={`/b/${businessId}/work`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      padding: spacing.md,
                      borderBottom: `1px solid ${cockpitColors.panelBorder}`,
                      display: "block",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{work.title}</div>
                        <div style={{ ...typography.caption, color: cockpitColors.textSecondary, marginTop: spacing.xs }}>
                          {work.workTypeLabel}
                          {work.partyName ? ` · ${work.partyName}` : ""}
                        </div>
                      </div>
                      <StatusBadge
                        label={work.overdue ? "Overdue" : work.status.replace(/_/g, " ")}
                        tone={work.overdue ? "warning" : "neutral"}
                      />
                    </div>
                    {work.dueLabel ? (
                      <div style={{ ...typography.caption, color: cockpitColors.textMuted, marginTop: spacing.xs }}>
                        {work.overdue ? `Overdue since ${work.dueLabel}` : `Due ${work.dueLabel}`}
                      </div>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </ShellPanel>
        ) : null}

        {operatingDetail ? (
          <ShellPanel title={labels.recentActivity ?? "Recent activity"}>
            {operatingDetail.recentActivity.length === 0 ? (
              <PanelEmpty description={labels.noActivity ?? "No activity for this property yet."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {operatingDetail.recentActivity.map((item) => {
                  const content = (
                    <div style={{ padding: spacing.md, borderBottom: `1px solid ${cockpitColors.panelBorder}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 650, color: cockpitColors.textPrimary }}>{item.title}</div>
                          {item.summary ? (
                            <div
                              style={{
                                ...typography.caption,
                                color: cockpitColors.textSecondary,
                                marginTop: spacing.xs,
                                lineHeight: 1.5,
                              }}
                            >
                              {item.summary}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ ...typography.caption, color: cockpitColors.textMuted, whiteSpace: "nowrap" }}>
                          {formatTimestamp(item.occurredAt)}
                        </div>
                      </div>
                    </div>
                  );

                  if (item.requestId) {
                    return (
                      <Link
                        key={item.id}
                        href={`/b/${businessId}/inbox/ct_ack_${item.requestId}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        {content}
                      </Link>
                    );
                  }
                  return <div key={item.id}>{content}</div>;
                })}
              </div>
            )}
          </ShellPanel>
        ) : null}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>{label}</div>
      <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textPrimary, fontWeight: 500 }}>{value}</div>
    </div>
  );
}
