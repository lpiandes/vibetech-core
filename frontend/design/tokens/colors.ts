import { brand } from "./brand";

export const semanticColors = {
  background: "var(--background)",
  surface: "var(--card)",
  surfaceSecondary: "var(--popover)",
  surfaceElevated: "var(--card)",
  border: "var(--border)",
  textPrimary: "var(--foreground)",
  textSecondary: "var(--secondary-foreground)",
  textMuted: "var(--muted-foreground)",
  accent: "var(--accent)",
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

/** App chrome — same hex values as vtechdevelopment.com */
export const cockpitColors = {
  background: brand.bgDeep,
  panel: brand.bg,
  panelElevated: "#111827",
  panelBorder: brand.border,
  inset: "#0a1220",
  overlay: "rgba(7, 11, 20, 0.72)",
  sidebar: brand.bgDeep,
  sidebarBorder: brand.border,
  sidebarText: brand.text,
  sidebarTextMuted: brand.textMuted,
  sidebarActive: "rgba(34, 211, 238, 0.10)",
  textPrimary: brand.text,
  textSecondary: brand.textMuted,
  /** Secondary copy on dark panels — keep ≥ #94a3b8 so it never blends into navy. */
  textMuted: brand.textMuted,
  /** Use only on intentional light surfaces (alerts, marketing chips). */
  inkOnLight: brand.navy,
  inkMutedOnLight: "#475569",
  accent: brand.cyan,
  accentMuted: "rgba(34, 211, 238, 0.14)",
  warning: "#f59e0b",
  critical: "#f87171",
  handled: "#34d399",
  waiting: "#fbbf24",
} as const;

export const statusSemantics = {
  critical: { label: "Critical", color: cockpitColors.critical, bg: "rgba(248,113,113,0.12)", icon: "!" },
  high: { label: "High", color: "#fb923c", bg: "rgba(251,146,60,0.12)", icon: "▲" },
  medium: { label: "Medium", color: cockpitColors.warning, bg: "rgba(245,158,11,0.12)", icon: "●" },
  low: { label: "Low", color: cockpitColors.textMuted, bg: "rgba(100,116,139,0.18)", icon: "○" },
  handled: { label: "Handled", color: cockpitColors.handled, bg: "rgba(52,211,153,0.12)", icon: "✓" },
  resolved: { label: "Resolved", color: cockpitColors.handled, bg: "rgba(52,211,153,0.12)", icon: "✓" },
  waiting: { label: "Waiting", color: cockpitColors.waiting, bg: "rgba(251,191,36,0.12)", icon: "…" },
  informational: { label: "Info", color: cockpitColors.accent, bg: cockpitColors.accentMuted, icon: "i" },
} as const;

export type StatusSemanticKey = keyof typeof statusSemantics;
