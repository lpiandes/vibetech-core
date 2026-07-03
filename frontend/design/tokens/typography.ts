/**
 * Executive-grade typography hierarchy (foundation tokens).
 * Units are `rem` so the system remains deterministic across customers.
 */
export const typography = {
  display: {
    fontSize: "2.5rem",
    lineHeight: "3rem",
    fontWeight: 700,
  },
  pageTitle: {
    fontSize: "1.875rem",
    lineHeight: "2.25rem",
    fontWeight: 650,
  },
  sectionTitle: {
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    fontWeight: 650,
  },
  cardTitle: {
    fontSize: "1rem",
    lineHeight: "1.5rem",
    fontWeight: 600,
  },
  body: {
    fontSize: "0.9375rem",
    lineHeight: "1.375rem",
    fontWeight: 500,
  },
  caption: {
    fontSize: "0.8125rem",
    lineHeight: "1.125rem",
    fontWeight: 500,
  },
  metric: {
    fontSize: "1.5rem",
    lineHeight: "2rem",
    fontWeight: 700,
  },
  label: {
    fontSize: "0.75rem",
    lineHeight: "1rem",
    fontWeight: 600,
  },
  button: {
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    fontWeight: 600,
  },
} as const;

export type TypographyKey = keyof typeof typography;

