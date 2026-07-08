"use client";

import type { ReactNode } from "react";

import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export default function ShellPanel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: radius.large,
        border: `1px solid ${cockpitColors.panelBorder}`,
        backgroundColor: cockpitColors.panel,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: `${spacing.sm} ${spacing.md}`,
          borderBottom: `1px solid ${cockpitColors.panelBorder}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: spacing.sm,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: typography.caption.fontSize, color: cockpitColors.textMuted, marginTop: 2 }}>{subtitle}</div>
          ) : null}
        </div>
        {action}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}
