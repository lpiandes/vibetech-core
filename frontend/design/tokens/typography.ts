/**
 * Executive-grade typography hierarchy.
 * Display / Title / Body / Meta aliases map to the operating-surface system.
 */
export const typography = {
  display: {
    fontSize: "2.5rem",
    lineHeight: "3rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  /** Alias: Title */
  title: {
    fontSize: "1.875rem",
    lineHeight: "2.25rem",
    fontWeight: 650,
    letterSpacing: "-0.015em",
  },
  pageTitle: {
    fontSize: "1.875rem",
    lineHeight: "2.25rem",
    fontWeight: 650,
    letterSpacing: "-0.015em",
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
    lineHeight: "1.5rem",
    fontWeight: 500,
  },
  /** Alias: Meta / supporting */
  meta: {
    fontSize: "0.8125rem",
    lineHeight: "1.25rem",
    fontWeight: 500,
  },
  caption: {
    fontSize: "0.8125rem",
    lineHeight: "1.25rem",
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
