/**
 * 8-point spacing system (foundation tokens).
 * Values are expressed in `rem` so they remain stable under typography changes.
 */
export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "2.5rem", // 40px
  "3xl": "3rem", // 48px
} as const;

export type SpacingKey = keyof typeof spacing;

