export const INSIGHT_CATEGORIES = [
  "health",
  "knowledge",
  "communications",
  "connected_systems",
  "workforce",
  "work_queue",
  "capabilities",
  "activities",
  "profile",
  "workspace",
];

export const INSIGHT_DIRECTIONS = [
  "improved",
  "declined",
  "unchanged",
  "new",
  "resolved",
];

export const INSIGHT_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

export const INSIGHT_SEVERITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const INSIGHT_DIRECTION_RANK = {
  new: 0,
  resolved: 1,
  declined: 2,
  improved: 3,
  unchanged: 4,
};

export function severityFromDelta({ deltaScore, riskNew, deltaCount } = {}) {
  const ds = typeof deltaScore === "number" ? deltaScore : null;
  const dc = typeof deltaCount === "number" ? deltaCount : null;

  if (riskNew) {
    // Deterministic risk severity: bigger signals => higher.
    if (dc !== null && dc >= 2) return "critical";
    return "high";
  }

  if (ds !== null) {
    if (ds <= -20) return "critical";
    if (ds <= -10) return "high";
    if (ds <= -5) return "medium";
    if (ds < 0) return "low";
    if (ds === 0) return "info";
    if (ds >= 20) return "high";
    if (ds >= 10) return "medium";
    if (ds >= 5) return "low";
    return "info";
  }

  if (dc !== null) {
    if (dc >= 10) return "critical";
    if (dc >= 5) return "high";
    if (dc >= 2) return "medium";
    if (dc >= 1) return "low";
    if (dc === 0) return "info";
    if (dc <= -10) return "critical";
    if (dc <= -5) return "high";
    if (dc <= -2) return "medium";
    if (dc < 0) return "low";
  }

  return "info";
}

export function directionFromDelta({ deltaScore } = {}) {
  if (typeof deltaScore !== "number") return "unchanged";
  if (deltaScore >= 5) return "improved";
  if (deltaScore <= -5) return "declined";
  if (deltaScore === 0) return "unchanged";
  return "unchanged";
}

