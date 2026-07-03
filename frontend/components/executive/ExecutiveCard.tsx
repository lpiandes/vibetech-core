import { semanticColors, spacing, radius, shadows, opacity } from "@/design/tokens";
import type { ReactNode } from "react";

export default function ExecutiveCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: semanticColors.surface,
        border: `1px solid ${semanticColors.border}`,
        borderRadius: radius.large,
        boxShadow: shadows.subtle,
        padding: spacing.lg,
        opacity: opacity.high,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

