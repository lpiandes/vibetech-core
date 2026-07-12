"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { cockpitColors, spacing, radius, typography } from "@/design/tokens";

export function Surface({
  children,
  as: Tag = "div",
  inset = false,
  style,
  ...rest
}: {
  children: ReactNode;
  as?: "div" | "section" | "article" | "aside";
  inset?: boolean;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  return (
    <Tag
      style={{
        backgroundColor: inset ? cockpitColors.inset : cockpitColors.panel,
        border: `1px solid ${cockpitColors.panelBorder}`,
        borderRadius: radius.large,
        padding: spacing.lg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function ActionButton({
  children,
  onClick,
  href,
  variant = "primary",
  disabled,
  type = "button",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  const styles: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 36,
    padding: `0 ${spacing.md}`,
    borderRadius: radius.medium,
    fontSize: typography.button.fontSize,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    textDecoration: "none",
    border: "1px solid transparent",
    ...(variant === "primary"
      ? { backgroundColor: cockpitColors.accent, color: "#fff" }
      : variant === "danger"
        ? { backgroundColor: "rgba(185,28,28,0.1)", color: cockpitColors.critical, borderColor: "rgba(185,28,28,0.25)" }
        : variant === "ghost"
          ? { backgroundColor: "transparent", color: cockpitColors.textSecondary, borderColor: cockpitColors.panelBorder }
          : {
              backgroundColor: cockpitColors.panelElevated,
              color: cockpitColors.textPrimary,
              borderColor: cockpitColors.panelBorder,
            }),
  };

  if (href && !disabled) {
    return (
      <Link href={href} aria-label={ariaLabel} style={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={styles}>
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Surface inset style={{ textAlign: "center", padding: spacing["3xl"] }}>
      <h2 style={{ margin: 0, fontSize: typography.sectionTitle.fontSize, color: cockpitColors.textPrimary }}>{title}</h2>
      {description ? (
        <p style={{ margin: `${spacing.md} auto 0`, maxWidth: 440, color: cockpitColors.textSecondary, lineHeight: 1.55 }}>
          {description}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: spacing.lg }}>{action}</div> : null}
    </Surface>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: spacing.xl, color: cockpitColors.textMuted }}>
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Surface role="alert" style={{ borderColor: "rgba(185,28,28,0.35)" }}>
      <p style={{ margin: 0, color: cockpitColors.critical }}>{message}</p>
      {onRetry ? (
        <div style={{ marginTop: spacing.md }}>
          <ActionButton variant="secondary" onClick={onRetry}>
            Try again
          </ActionButton>
        </div>
      ) : null}
    </Surface>
  );
}
