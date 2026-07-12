/**
 * Consistent radius scale — small 6 / medium 12 / large 20.
 */
export const radius = {
  small: "0.375rem", // 6px
  medium: "0.75rem", // 12px
  large: "1.25rem", // 20px
  pill: "9999px",
} as const;

export type RadiusKey = keyof typeof radius;
