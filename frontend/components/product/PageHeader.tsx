import type { ReactNode } from "react";

import { cockpitColors, spacing, typography } from "@/design/tokens";

export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ ...typography.pageTitle, color: cockpitColors.textPrimary, margin: 0 }}>{title}</h1>
        {description ? (
          <p style={{ ...typography.body, color: cockpitColors.textSecondary, margin: `${spacing.sm} 0 0`, maxWidth: 520 }}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
