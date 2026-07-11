"use client";

import type { CSSProperties } from "react";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

/**
 * Empty State Renderer — Business OS / module empty copy, never raw enums.
 */
export default function EmptyStateRenderer({
  title,
  description,
  action,
  compact = false,
}: {
  title?: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void } | null;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      style={{
        ...shell,
        padding: compact ? spacing.md : spacing.xl,
        textAlign: compact ? "left" : "center",
      }}
    >
      {title ? (
        <div style={{
          fontWeight: 650,
          fontSize: compact ? typography.body.fontSize : "1.15rem",
          color: cockpitColors.textPrimary,
          marginBottom: spacing.xs,
        }}>
          {title}
        </div>
      ) : null}
      <div style={{
        color: cockpitColors.textMuted,
        fontSize: typography.body.fontSize,
        lineHeight: 1.5,
        maxWidth: compact ? undefined : 480,
        margin: compact ? 0 : "0 auto",
      }}>
        {description}
      </div>
      {action?.href ? (
        <a href={action.href} style={actionStyle}>{action.label}</a>
      ) : null}
      {action?.onClick ? (
        <button type="button" onClick={action.onClick} style={actionButtonStyle}>{action.label}</button>
      ) : null}
    </div>
  );
}

const shell: CSSProperties = {
  borderRadius: radius.large,
  border: `1px solid ${cockpitColors.panelBorder}`,
  backgroundColor: cockpitColors.panel,
};

const actionStyle: CSSProperties = {
  display: "inline-block",
  marginTop: spacing.md,
  color: cockpitColors.accent,
  fontWeight: 650,
  textDecoration: "none",
};

const actionButtonStyle: CSSProperties = {
  ...actionStyle,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
