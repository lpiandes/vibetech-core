import { semanticColors, spacing, typography } from "@/design/tokens";
import type { ReactNode } from "react";

export default function ExecutiveIcon({ icon, label }: { icon: ReactNode; label?: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: spacing.xs }}>
      <div style={{ color: semanticColors.textPrimary, display: "inline-flex" }}>{icon}</div>
      {label ? (
        <div style={{ color: semanticColors.textSecondary, fontSize: typography.caption.fontSize, lineHeight: typography.caption.lineHeight, fontWeight: typography.caption.fontWeight }}>
          {label}
        </div>
      ) : null}
    </div>
  );
}

