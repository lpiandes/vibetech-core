import {
  HEALTH_STATUS,
  STATUS_BY_SCORE,
  TREND_FROM_SCORE,
  clampScore,
} from "./CompanyHealthDefaults.js";

export function scoreToStatus(score) {
  const s = clampScore(score);
  for (const r of STATUS_BY_SCORE) {
    if (s >= r.min && s <= r.max) return r.status;
  }
  return HEALTH_STATUS.UNKNOWN;
}

export function scoreToTrend(score) {
  return TREND_FROM_SCORE(score);
}

export function scoreToConfidence({ hasData, strength } = {}) {
  // Deterministic confidence based on available inputs.
  // strength: boolean that indicates whether the signal is strong/complete.
  if (!hasData) return 0.2;
  if (strength) return 0.85;
  return 0.6;
}

export function computeOverallScore(dimensionScores) {
  const arr = Array.isArray(dimensionScores) ? dimensionScores : [];
  if (!arr.length) return 0;
  const sum = arr.reduce((acc, n) => acc + clampScore(n), 0);
  return Math.round(sum / arr.length);
}

