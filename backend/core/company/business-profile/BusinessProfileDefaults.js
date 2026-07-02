// Sprint 4 defaults
// Kept intentionally minimal; BusinessProfileBuilder deterministically fills operational defaults.

export function createBusinessProfileDefaults() {
  return Object.freeze({
    version: 1,
    metadata: {
      createdAtISO: "",
      updatedAtISO: "",
      completionStatus: "INCOMPLETE",
      completionPercent: 0,
      validation: { ok: false, issues: [] },
    },
  });
}

