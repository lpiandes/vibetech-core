export const OPPORTUNITY_CATEGORIES = [
  "knowledge",
  "communications",
  "automation",
  "digital_workforce",
  "connected_systems",
  "onboarding",
  "business_profile",
  "company_profile",
  "work_queue",
  "operations",
];

export const OPPORTUNITY_PRIORITY = ["IMMEDIATE", "SOON", "LATER"];

export const OPPORTUNITY_IMPACT = [
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
];

export const OPPORTUNITY_EFFORT = ["Small", "Medium", "Large"];

export const OPPORTUNITY_PRIORITY_RANK = {
  IMMEDIATE: 0,
  SOON: 1,
  LATER: 2,
};

export const OPPORTUNITY_IMPACT_RANK = {
  "Very High": 0,
  High: 1,
  Medium: 2,
  Low: 3,
  "Very Low": 4,
};

export const OPPORTUNITY_EFFORT_RANK = {
  Small: 0,
  Medium: 1,
  Large: 2,
};

export function clamp01(n) {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(1, num));
}

export function impactFromScore(score0to100) {
  const s = typeof score0to100 === "number" ? score0to100 : 0;
  const clamped = Math.max(0, Math.min(100, s));
  if (clamped >= 85) return "Very High";
  if (clamped >= 70) return "High";
  if (clamped >= 55) return "Medium";
  if (clamped >= 35) return "Low";
  return "Very Low";
}

export function effortFromSize(size) {
  const s = String(size ?? "").toUpperCase();
  if (s === "SMALL") return "Small";
  if (s === "MEDIUM") return "Medium";
  return "Large";
}

export function priorityFromSignals({ impact, urgencyScore } = {}) {
  // Deterministic priority: urgencyScore and impact drive the tier.
  const iRank = OPPORTUNITY_IMPACT_RANK[String(impact)] ?? 2;
  const u = typeof urgencyScore === "number" ? urgencyScore : 0;
  if (u >= 80 || iRank <= 1) return "IMMEDIATE";
  if (u >= 50 || iRank === 2) return "SOON";
  return "LATER";
}

