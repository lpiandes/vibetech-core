export const KNOWLEDGE_READINESS_DEFAULTS = {
  // Knowledge is considered stale when the most recent update is older than this threshold.
  staleDaysThreshold: 30,

  // Confidence below this threshold is considered low-confidence knowledge.
  lowConfidenceThreshold: 0.65,

  // If a large share of active knowledge is low-confidence, we increase risk.
  lowConfidenceCoverageRatio: 0.5,

  // Priority mapping used for executive cards.
  // Gap priority tiers are derived deterministically from risk/coverage.
  priorityTiers: {
    immediate: 80,
    soon: 50,
    later: 20,
  },
};
