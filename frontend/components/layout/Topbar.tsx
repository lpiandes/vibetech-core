import type { ReactNode } from "react";
import { Bell, Command, UserRound, Search } from "lucide-react";

import { semanticColors, spacing, typography, radius, shadows } from "@/design/tokens";
import StatusPill from "@/components/executive/StatusPill";

function PlaceholderIcon({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: spacing["2xl"],
        height: spacing["2xl"],
        borderRadius: radius.large,
        border: `1px solid ${semanticColors.border}`,
        backgroundColor: semanticColors.surface,
        color: semanticColors.textMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export default function Topbar() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${semanticColors.border}`,
        backgroundColor: semanticColors.background,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        gap: spacing.lg,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div
            style={{
              fontSize: typography.label.fontSize,
              lineHeight: typography.label.lineHeight,
              fontWeight: typography.label.fontWeight,
              color: semanticColors.textMuted,
            }}
          >
            Workspace / Page
          </div>
          <div style={{ fontSize: typography.sectionTitle.fontSize, lineHeight: typography.sectionTitle.lineHeight, fontWeight: typography.sectionTitle.fontWeight, color: semanticColors.textPrimary }}>
            Business Operating System
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        <div style={{ position: "relative", display: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <div className="hidden lg:block" style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: spacing.sm, top: "50%", transform: "translateY(-50%)", width: spacing.md, height: spacing.md, color: semanticColors.textMuted }} />
            <input
              disabled
              placeholder="Search"
              style={{
                height: spacing["2xl"],
                width: "100%",
                borderRadius: radius.medium,
                border: `1px solid ${semanticColors.border}`,
                backgroundColor: semanticColors.background,
                color: semanticColors.textPrimary,
                paddingLeft: `calc(${spacing.sm} + ${spacing.md})`,
                paddingRight: spacing.md,
                fontSize: typography.body.fontSize,
                lineHeight: typography.body.lineHeight,
                fontWeight: typography.body.fontWeight,
                outline: "none",
                boxShadow: shadows.subtle,
              }}
            />
          </div>

          <PlaceholderIcon>
            <Bell style={{ width: spacing.md, height: spacing.md }} />
          </PlaceholderIcon>
          <PlaceholderIcon>
            <Command style={{ width: spacing.md, height: spacing.md }} />
          </PlaceholderIcon>
          <StatusPill tone="neutral" label="Quick actions" />
          <PlaceholderIcon>
            <UserRound style={{ width: spacing.md, height: spacing.md }} />
          </PlaceholderIcon>
        </div>
      </div>
    </div>
  );
}

