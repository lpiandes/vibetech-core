import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { COMPANY_HEALTH_VERSION } from "./CompanyHealthDefaults.js";

export function createCompanyHealth({
  healthId,
  companyId,
  generatedAt,
  overallScore,
  overallStatus,
  overallTrend,
  overallConfidence,
  dimensions,
  strengths,
  risks,
  recommendations,
  summary,
  metadata,
} = {}) {
  if (!healthId || typeof healthId !== "string") throw new Error("CompanyHealth: healthId required.");
  if (!companyId || typeof companyId !== "string") throw new Error("CompanyHealth: companyId required.");
  if (!generatedAt || typeof generatedAt !== "string") throw new Error("CompanyHealth: generatedAt required.");
  if (typeof overallScore !== "number") throw new Error("CompanyHealth: overallScore must be number.");
  if (!overallStatus || typeof overallStatus !== "string") throw new Error("CompanyHealth: overallStatus required.");
  if (!overallTrend || typeof overallTrend !== "string") throw new Error("CompanyHealth: overallTrend required.");
  if (typeof overallConfidence !== "number") throw new Error("CompanyHealth: overallConfidence must be number.");
  if (!Array.isArray(dimensions)) throw new Error("CompanyHealth: dimensions required.");
  if (!Array.isArray(strengths)) throw new Error("CompanyHealth: strengths required.");
  if (!Array.isArray(risks)) throw new Error("CompanyHealth: risks required.");
  if (!Array.isArray(recommendations)) throw new Error("CompanyHealth: recommendations required.");
  if (typeof summary !== "string") throw new Error("CompanyHealth: summary required.");

  const health = {
    healthId,
    companyId,
    generatedAt,
    overallScore: clampScore(overallScore),
    overallStatus: String(overallStatus),
    overallTrend: String(overallTrend),
    overallConfidence: Number(overallConfidence),
    dimensions: deepFreeze(dimensions),
    strengths: deepFreeze(strengths),
    risks: deepFreeze(risks),
    recommendations: deepFreeze(recommendations),
    summary,
    metadata: {
      version: COMPANY_HEALTH_VERSION,
      ...((metadata && typeof metadata === "object") ? metadata : {}),
    },
  };

  return deepFreeze(health);
}

function clampScore(n) {
  const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

