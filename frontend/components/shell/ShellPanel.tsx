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
        borderRadius: 16,
        border: "1px solid #e8edf2",
        backgroundColor: cockpitColors.panel,
        boxShadow: "0 8px 22px rgba(15,23,42,.035)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: `${spacing.md} ${spacing.lg}`,
          borderBottom: "1px solid #eef2f5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: spacing.sm,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 750, fontSize: typography.body.fontSize, color: cockpitColors.textPrimary, letterSpacing: "-.01em" }}>{title}</div>
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
