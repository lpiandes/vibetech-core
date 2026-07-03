/**
 * Motion tokens (foundation tokens only).
 * No implementations yet.
 */
export const motion = {
  fast: "120ms",
  normal: "200ms",
  slow: "320ms",

  hover: "140ms",
  pageTransition: "420ms",

  // Easing names are intentionally abstract; future implementation can map them.
  easing: {
    standard: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    soft: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const;

export type MotionKey = keyof typeof motion;

