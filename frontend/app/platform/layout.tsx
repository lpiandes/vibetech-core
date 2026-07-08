import type { ReactNode } from "react";

import PlatformAdminScreen from "@/components/platform/PlatformAdminScreen";
import { ProductPage, PageHeader } from "@/components/product";
import { cockpitColors, spacing } from "@/design/tokens";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: cockpitColors.background }}>
      <div style={{ borderBottom: `1px solid ${cockpitColors.panelBorder}`, padding: `${spacing.md} ${spacing.lg}` }}>
        <strong style={{ color: cockpitColors.accent }}>VIBETech</strong>
        <span style={{ marginLeft: spacing.md, color: cockpitColors.textMuted, fontSize: "0.85rem" }}>Platform</span>
      </div>
      <div style={{ padding: spacing.lg }}>{children}</div>
    </div>
  );
}
