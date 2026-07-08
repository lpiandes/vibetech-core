import type { ReactNode } from "react";

import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ padding: spacing.xl, textAlign: "center" }}>
      {icon ? (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: spacing.md, color: cockpitColors.textMuted }}>{icon}</div>
      ) : null}
      <div style={{ fontWeight: 600, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{title}</div>
      {description ? (
        <p style={{ ...typography.caption, color: cockpitColors.textSecondary, margin: `${spacing.sm} auto 0`, maxWidth: 360, lineHeight: 1.45 }}>
          {description}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: spacing.md, display: "flex", justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}
