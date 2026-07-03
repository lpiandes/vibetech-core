/**
 * Consistent radius scale (foundation tokens).
 * Values are expressed in `rem` for deterministic spacing across themes.
 */
export const radius = {
  small: "0.375rem",
  medium: "0.625rem",
  large: "0.875rem",
  pill: "9999px",
} as const;

export type RadiusKey = keyof typeof radius;

