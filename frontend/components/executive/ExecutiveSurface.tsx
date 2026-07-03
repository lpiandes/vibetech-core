import { semanticColors, radius, shadows } from "@/design/tokens";
import type { ReactNode } from "react";

export default function ExecutiveSurface({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: semanticColors.background,
        color: semanticColors.textPrimary,
        borderRadius: radius.large,
        boxShadow: shadows.none,
      }}
    >
      {children}
    </div>
  );
}

