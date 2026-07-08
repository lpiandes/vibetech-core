import type { ReactNode } from "react";

import { cockpitColors, spacing } from "@/design/tokens";

export const PRODUCT_PAGE_MAX_WIDTH = 720;

export default function ProductPage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.lg,
        maxWidth: PRODUCT_PAGE_MAX_WIDTH,
        width: "100%",
        paddingBottom: spacing.xl,
      }}
    >
      {children}
    </div>
  );
}
