import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  HEALTH_STATUS,
  TREND_FROM_SCORE,
} from "./CompanyHealthDefaults.js";
import { scoreToConfidence, scoreToStatus, scoreToTrend } from "./CompanyHealthScore.js";

export function createCompanyHealthDimension({
  id,
  title,
  score,
  status,
  trend,
  confidence,
  summary,
  recommendations,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") throw new Error("CompanyHealthDimension: id required.");
  if (!title || typeof title !== "string") throw new Error("CompanyHealthDimension: title required.");
  if (typeof score !== "number") throw new Error("CompanyHealthDimension: score must be a number.");

  const derivedStatus = status ?? scoreToStatus(score);
  const derivedTrend = trend ?? scoreToTrend(score);
  const derivedConfidence =
    confidence ?? scoreToConfidence({ hasData: true, strength: derivedStatus === HEALTH_STATUS.EXCELLENT || derivedStatus === HEALTH_STATUS.GOOD });

  const dim = {
    id,
    title,
    score: clampScore(score),
    status: String(derivedStatus),
    trend: String(derivedTrend ?? TREND_FROM_SCORE(score)),
    confidence: Number(derivedConfidence),
    summary: String(summary ?? ""),
    recommendations: Array.isArray(recommendations) ? deepFreeze(recommendations) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(dim);
}

function clampScore(n) {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

