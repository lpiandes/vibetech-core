import type { ReactNode } from "react";

import { cockpitColors, spacing, typography } from "@/design/tokens";

/** Page title only — no essay under the name. */
export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  /** Ignored for simplicity — keep APIs stable. */
  description?: string;
  action?: ReactNode;
}) {
  void description;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        padding: `${spacing.xs} 0`,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "1.75rem",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          color: cockpitColors.textPrimary,
          fontFamily: "inherit",
        }}
      >
        {title}
      </h1>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
