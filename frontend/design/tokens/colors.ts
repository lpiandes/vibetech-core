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

