"use client";

import { useContext } from "react";

import { MissionControlViewModelContext } from "@/components/mission-control/MissionControlContext";
import { useOptionalBusinessScope } from "@/lib/platform/BusinessScopeContext";
import DecisionsQueue from "@/components/decisions/DecisionsQueue";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

function safeArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

export default function AttentionExecutiveLayout() {
  const viewModel = useContext(MissionControlViewModelContext);
  const scope = useOptionalBusinessScope();
  const items = safeArray(viewModel?.attentionItems ?? viewModel?.needsYourAttention);
  const businessId = String(
    scope?.businessId
    ?? (viewModel as { businessId?: string } | null)?.businessId
    ?? "",
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

      <DecisionsQueue items={items} businessId={businessId} />
    </div>
  );
}
