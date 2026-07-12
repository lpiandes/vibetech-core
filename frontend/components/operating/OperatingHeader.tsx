"use client";

import type { CSSProperties, ReactNode } from "react";
import { cockpitColors, spacing, typography } from "@/design/tokens";
import { scrubInternalWording } from "@/lib/operating/businessLanguage";

/**
 * Calm page header for operating surfaces — one focus, generous type.
 */
export default function OperatingHeader({
  title,
  summary,
  eyebrow,
  actions,
}: {
  title: string;
  summary?: string | null;
  eyebrow?: string | null;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: spacing.lg,
        alignItems: "flex-start",
        flexWrap: "wrap",
        marginBottom: spacing.lg,
      }}
    >
      <div style={{ maxWidth: 720 }}>
        {eyebrow ? (
          <p
            style={{
              margin: 0,
              fontSize: typography.label.fontSize,
              fontWeight: 650,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: cockpitColors.textMuted,
            }}
          >
            {scrubInternalWording(eyebrow)}
          </p>
        ) : null}
        <h1
          style={{
            margin: eyebrow ? `${spacing.sm} 0 0` : 0,
            fontSize: typography.display.fontSize,
            lineHeight: typography.display.lineHeight,
            fontWeight: typography.display.fontWeight,
            letterSpacing: typography.display.letterSpacing,
            color: cockpitColors.textPrimary,
          }}
        >
          {scrubInternalWording(title)}
        </h1>
        {summary ? (
          <p
            style={{
              margin: `${spacing.md} 0 0`,
              fontSize: typography.body.fontSize,
              lineHeight: 1.6,
              color: cockpitColors.textSecondary,
              maxWidth: 560,
            }}
          >
            {scrubInternalWording(summary)}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>{actions}</div> : null}
    </header>
  );
}

export function OperatingSection({
  id,
  title,
  description,
  children,
  action,
  quiet = false,
}: {
  id?: string;
  title: string;
  description?: string | null;
  children: ReactNode;
  action?: ReactNode;
  quiet?: boolean;
}) {
  const headingId = id ?? undefined;
  return (
    <section
      aria-labelledby={headingId}
      style={{
        display: "grid",
        gap: spacing.md,
        paddingTop: spacing.lg,
        borderTop: quiet ? "none" : `1px solid ${cockpitColors.panelBorder}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <h2
            id={headingId}
            style={{
              margin: 0,
              fontSize: typography.sectionTitle.fontSize,
              fontWeight: typography.sectionTitle.fontWeight,
              color: cockpitColors.textPrimary,
            }}
          >
            {scrubInternalWording(title)}
          </h2>
          {description ? (
            <p style={{ margin: `${spacing.xs} 0 0`, color: cockpitColors.textMuted, fontSize: typography.meta.fontSize }}>
              {scrubInternalWording(description)}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const quietRowStyle: CSSProperties = {
  display: "grid",
  gap: spacing.sm,
  padding: `${spacing.md} 0`,
  borderBottom: `1px solid ${cockpitColors.panelBorder}`,
};
