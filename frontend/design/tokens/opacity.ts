/**
 * Opacity tokens (foundation tokens).
 */
export const opacity = {
  high: "0.9",
  medium: "0.7",
  low: "0.5",
  veryLow: "0.25",
} as const;

export type OpacityKey = keyof typeof opacity;

