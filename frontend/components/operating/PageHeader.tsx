"use client";

import type { ReactNode } from "react";
import { cockpitColors, spacing, typography } from "@/design/tokens";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
        <div style={{ display: "grid", gap: spacing.xs, maxWidth: 720 }}>
        {eyebrow ? (
          <div
            style={{
              fontSize: typography.label.fontSize,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: cockpitColors.accent,
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: typography.pageTitle.fontSize,
            lineHeight: typography.pageTitle.lineHeight,
            fontWeight: typography.pageTitle.fontWeight,
            letterSpacing: (typography.pageTitle as any).letterSpacing,
            color: cockpitColors.textPrimary,
          }}
        >
          {title}
        </h1>
        {description ? (
          <p style={{ margin: 0, color: cockpitColors.textSecondary, lineHeight: 1.55, fontSize: typography.body.fontSize }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: spacing.md,
        marginBottom: spacing.md,
      }}
    >
      <div>
        <h2
          id={id}
          style={{
            margin: 0,
            fontSize: typography.sectionTitle.fontSize,
            fontWeight: typography.sectionTitle.fontWeight,
            color: cockpitColors.textPrimary,
          }}
        >
          {title}
        </h2>
        {description ? (
          <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
