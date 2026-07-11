import type { CSSProperties } from "react";
import { cockpitColors, spacing, typography, radius } from "@/design/tokens";

export const builderCanvas: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 48%, #EEF2FF 100%)",
};

export const builderShell: CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  padding: spacing.xl,
  display: "grid",
  gap: spacing.lg,
};

export const builderPanel: CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.large,
  padding: spacing.lg,
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.05)",
};

export const builderTitle: CSSProperties = {
  margin: 0,
  fontSize: "1.6rem",
  fontWeight: 750,
  letterSpacing: "-0.02em",
  color: cockpitColors.textPrimary,
};

export const builderMuted: CSSProperties = {
  margin: 0,
  color: cockpitColors.textMuted,
  fontSize: typography.body.fontSize,
  lineHeight: 1.5,
};

export const builderInput: CSSProperties = {
  width: "100%",
  borderRadius: radius.medium,
  border: `1px solid ${cockpitColors.panelBorder}`,
  padding: "12px 14px",
  fontSize: 15,
  background: "#fff",
  color: cockpitColors.textPrimary,
};

export const builderCard: CSSProperties = {
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: spacing.md,
  background: "#FCFDFE",
};

export function primaryButton(accent = "#0F766E"): CSSProperties {
  return {
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: radius.medium,
    padding: "11px 16px",
    fontWeight: 650,
    cursor: "pointer",
  };
}

export const secondaryButton: CSSProperties = {
  background: "#fff",
  color: cockpitColors.textPrimary,
  border: `1px solid ${cockpitColors.panelBorder}`,
  borderRadius: radius.medium,
  padding: "11px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

export function statusTone(status: string): { background: string; color: string } {
  switch (String(status)) {
    case "ready":
    case "complete":
    case "confirmed":
    case "installed":
      return { background: "#ECFDF5", color: "#047857" };
    case "needs_setup":
    case "active":
    case "pending":
    case "requires_approval":
      return { background: "#FFF7ED", color: "#C2410C" };
    case "unsupported":
    case "failed":
    case "rejected":
      return { background: "#FEF2F2", color: "#B91C1C" };
    case "deferred":
    default:
      return { background: "#F1F5F9", color: "#475569" };
  }
}
