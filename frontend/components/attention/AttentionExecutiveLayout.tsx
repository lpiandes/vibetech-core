"use client";

import { useContext, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import StatusPill from "@/components/executive/StatusPill";
import { cockpitColors, spacing, typography, radius, semanticColors } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

function priorityTone(p: string): "danger" | "warning" | "neutral" {
  if (p === "critical") return "danger";
  if (p === "high" || p === "warning") return "warning";
  return "neutral";
}

export default function AttentionExecutiveLayout() {
  const viewModel = useContext(MissionControlViewModelContext);
  const router = useRouter();
  const items = safeArray(viewModel?.attentionItems ?? viewModel?.needsYourAttention);

  const handleApproval = useCallback(
    async (approvalId: string, decision: string) => {
      await fetch(`/api/approvals/${approvalId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    },
    [router],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md, paddingBottom: spacing.lg }}>
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.large,
          border: `1px solid ${cockpitColors.panelBorder}`,
          backgroundColor: cockpitColors.panel,
        }}
      >
        <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: cockpitColors.textMuted }}>
          Owner decisions
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: "1.25rem", fontWeight: 650, color: cockpitColors.textPrimary }}>
          {viewModel?.pageTitle ?? "Needs decision"}
        </div>
        <div style={{ marginTop: spacing.xs, fontSize: typography.body.fontSize, color: cockpitColors.textSecondary }}>
          Only items requiring meaningful human intervention
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: spacing.md, color: cockpitColors.textMuted, borderRadius: radius.large, border: `1px solid ${cockpitColors.panelBorder}`, backgroundColor: cockpitColors.panel }}>
          Nothing requires your judgment. VIBETech is operating routine work.
        </div>
      ) : (
        items.map((item: any) => {
          const approveAction = item.availableActions?.find((a: any) => a.id === "approve");
          const rejectAction = item.availableActions?.find((a: any) => a.id === "reject");
          const reviewAction = item.availableActions?.find((a: any) => a.href && a.id !== "approve" && a.id !== "reject");

          return (
            <div
              key={String(item.id)}
              style={{
                padding: spacing.md,
                borderRadius: radius.large,
                border: `1px solid ${cockpitColors.panelBorder}`,
                backgroundColor: cockpitColors.panel,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 650, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{item.title}</div>
                <StatusPill tone={priorityTone(item.priorityBadge ?? item.priority)} label={item.priority} />
              </div>
              <div style={{ marginTop: spacing.sm, color: cockpitColors.textSecondary, lineHeight: 1.5, fontSize: typography.body.fontSize }}>{item.summary}</div>
              {item.reason ? (
                <div style={{ marginTop: spacing.xs, fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                  <strong>Why:</strong> {item.reason}
                </div>
              ) : null}
              {item.businessImpact ? (
                <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.warning }}>
                  <strong>Impact:</strong> {item.businessImpact}
                </div>
              ) : null}
              {item.recommendedAction ? (
                <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted }}>
                  <strong>Recommendation:</strong> {item.recommendedAction}
                </div>
              ) : null}
              <div style={{ marginTop: spacing.md, display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                {approveAction ? (
                  <button
                    type="button"
                    onClick={() => handleApproval(item.approvalId ?? item.sourceId, "GRANT")}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      borderRadius: radius.medium,
                      border: "none",
                      backgroundColor: semanticColors.success,
                      color: "#fff",
                      fontSize: typography.caption.fontSize,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                ) : null}
                {rejectAction ? (
                  <button
                    type="button"
                    onClick={() => handleApproval(item.approvalId ?? item.sourceId, "REJECT")}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      backgroundColor: "transparent",
                      color: cockpitColors.textSecondary,
                      fontSize: typography.caption.fontSize,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                ) : null}
                {reviewAction?.href ? (
                  <Link
                    href={reviewAction.href}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      color: cockpitColors.accent,
                      fontSize: typography.caption.fontSize,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {reviewAction.label} →
                  </Link>
                ) : null}
                {item.partyId ? (
                  <Link
                    href={`/engagement/${item.partyId}`}
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      color: cockpitColors.accent,
                      fontSize: typography.caption.fontSize,
                      textDecoration: "none",
                    }}
                  >
                    View person →
                  </Link>
                ) : null}
                {item.sourceType === "work" ? (
                  <Link
                    href="/work"
                    style={{
                      padding: `${spacing.xs} ${spacing.md}`,
                      borderRadius: radius.medium,
                      border: `1px solid ${cockpitColors.panelBorder}`,
                      color: cockpitColors.accent,
                      fontSize: typography.caption.fontSize,
                      textDecoration: "none",
                    }}
                  >
                    Open work →
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
