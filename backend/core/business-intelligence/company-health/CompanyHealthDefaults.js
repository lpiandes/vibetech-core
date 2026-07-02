export const COMPANY_HEALTH_VERSION = 1;

export const HEALTH_DIMENSIONS = [
  "knowledge_health",
  "communication_health",
  "connected_systems_health",
  "digital_workforce_health",
  "operational_readiness",
  "business_profile_health",
  "company_profile_health",
  "workspace_health",
];

export const HEALTH_STATUS = {
  UNKNOWN: "UNKNOWN",
  CRITICAL: "CRITICAL",
  POOR: "POOR",
  FAIR: "FAIR",
  GOOD: "GOOD",
  EXCELLENT: "EXCELLENT",
};

export const STATUS_BY_SCORE = [
  { min: 0, max: 19, status: HEALTH_STATUS.CRITICAL },
  { min: 20, max: 39, status: HEALTH_STATUS.POOR },
  { min: 40, max: 59, status: HEALTH_STATUS.FAIR },
  { min: 60, max: 79, status: HEALTH_STATUS.GOOD },
  { min: 80, max: 100, status: HEALTH_STATUS.EXCELLENT },
];

export const TREND = {
  UP: "UP",
  DOWN: "DOWN",
  STABLE: "STABLE",
  UNKNOWN: "UNKNOWN",
};

export const TREND_FROM_SCORE = (score) => {
  if (typeof score !== "number" || Number.isNaN(score)) return TREND.UNKNOWN;
  if (score >= 80) return TREND.UP;
  if (score <= 40) return TREND.DOWN;
  return TREND.STABLE;
};

export const STATUS_IS_STRENGTH = (status) =>
  status === HEALTH_STATUS.GOOD || status === HEALTH_STATUS.EXCELLENT;

export const STATUS_IS_RISK = (status) =>
  status === HEALTH_STATUS.CRITICAL || status === HEALTH_STATUS.POOR;

export function clampScore(n) {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

