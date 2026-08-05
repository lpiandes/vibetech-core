import { brand } from "./brand";

export const semanticColors = {
  // App surfaces + text (already defined by the current shadcn/tailwind theme CSS variables).
  background: "var(--background)",
  surface: "var(--card)",
  surfaceSecondary: "var(--popover)",
  surfaceElevated: "var(--card)",

  border: "var(--border)",

  textPrimary: "var(--foreground)",
  textSecondary: "var(--secondary-foreground)",
  textMuted: "var(--muted-foreground)",

  // Brand/accent semantic slot (mapped to current theme accent).
  accent: "var(--accent)",

  // Status/health semantics (foundation tokens only; values can be overridden per customer theme later).
  success: "oklch(0.77 0.18 155)",
  warning: "oklch(0.87 0.16 80)",
  danger: "oklch(0.65 0.21 25)",
  info: "oklch(0.72 0.18 205)",

  healthExcellent: "oklch(0.77 0.18 155)",
  healthGood: "oklch(0.86 0.13 170)",
  healthWarning: "oklch(0.87 0.16 80)",
  healthCritical: "oklch(0.65 0.21 25)",
} as const;

export type SemanticColorKey = keyof typeof semanticColors;

/**
 * Operating cockpit — aligned to vtechdevelopment.com (cyan · purple · navy).
 * Light canvas for work; deep navy sidebar; cyan accent.
 */
export const cockpitColors = {
  background: "#f1f5f9",
  panel: "#ffffff",
  panelElevated: "#f8fafc",
  panelBorder: "rgba(15, 23, 42, 0.08)",
  inset: "#e2e8f0",
  overlay: "rgba(7, 11, 20, 0.55)",
  sidebar: brand.bgDeep,
  sidebarBorder: brand.border,
  sidebarText: brand.text,
  sidebarTextMuted: brand.textMuted,
  sidebarActive: "rgba(34, 211, 238, 0.12)",
  textPrimary: brand.navy,
  textSecondary: "#334155",
  textMuted: "#64748b",
  accent: brand.accentOnLight,
  accentMuted: brand.accentMutedOnLight,
  warning: "#b45309",
  critical: "#b91c1c",
  handled: "#0f766e",
  waiting: "#a16207",
} as const;

/** Semantic operational status — always pair with text/icon, not color alone. */
export const statusSemantics = {
  critical: { label: "Critical", color: cockpitColors.critical, bg: "rgba(185,28,28,0.1)", icon: "!" },
  high: { label: "High", color: "#c2410c", bg: "rgba(194,65,12,0.1)", icon: "▲" },
  medium: { label: "Medium", color: cockpitColors.warning, bg: "rgba(180,83,9,0.1)", icon: "●" },
  low: { label: "Low", color: cockpitColors.textMuted, bg: "rgba(120,113,108,0.12)", icon: "○" },
  handled: { label: "Handled", color: cockpitColors.handled, bg: "rgba(4,120,87,0.1)", icon: "✓" },
  resolved: { label: "Resolved", color: cockpitColors.handled, bg: "rgba(4,120,87,0.1)", icon: "✓" },
  waiting: { label: "Waiting", color: cockpitColors.waiting, bg: "rgba(161,98,7,0.1)", icon: "…" },
  informational: { label: "Info", color: cockpitColors.accent, bg: cockpitColors.accentMuted, icon: "i" },
} as const;

export type StatusSemanticKey = keyof typeof statusSemantics;
