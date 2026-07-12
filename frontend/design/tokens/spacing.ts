/**
 * Operating-surface design tokens — premium VIBETech supervision UI.
 * Extends foundation tokens without breaking existing imports.
 */
export const spacingScale = {
  4: "0.25rem",
  8: "0.5rem",
  12: "0.75rem",
  16: "1rem",
  24: "1.5rem",
  32: "2rem",
  48: "3rem",
  64: "4rem",
} as const;

/** Named aliases (legacy + scale). */
export const spacing = {
  xs: spacingScale[4],
  sm: spacingScale[8],
  md: spacingScale[16],
  lg: spacingScale[24],
  xl: spacingScale[32],
  "2xl": "2.5rem",
  "3xl": spacingScale[48],
  "4xl": spacingScale[64],
  /** Numeric scale access */
  ...spacingScale,
} as const;

export type SpacingKey = keyof typeof spacing;
