"use client";

import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function MissionControlLoading() {
  return (
    <div style={{ padding: spacing.lg, color: cockpitColors.textMuted, fontSize: typography.body.fontSize }}>
      Loading…
    </div>
  );
}
