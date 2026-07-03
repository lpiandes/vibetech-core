/**
 * Subtle, executive shadows (foundation tokens).
 * No assumptions about component shape; intended for future use.
 */
export const shadows = {
  none: "none",
  subtle: "0 1px 2px oklch(0.15 0 0 / 0.06)",
  small: "0 2px 6px oklch(0.15 0 0 / 0.08)",
  medium: "0 10px 24px oklch(0.15 0 0 / 0.12)",
  elevated: "0 16px 40px oklch(0.15 0 0 / 0.14)",
} as const;

export type ShadowKey = keyof typeof shadows;

