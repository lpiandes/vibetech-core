import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsIntelligenceReport: ${message}`);
}

export function createAnalyticsIntelligenceReport({
  reportId,
  companyId = null,
  generatedAt,
  summary,
  overallPerformance,
  kpis,
  trends,
  insights,
  recommendations,
  metrics,
  metadata,
} = {}) {
  if (!reportId) fail("reportId required.");
  if (!generatedAt) fail("generatedAt required.");
  if (overallPerformance === undefined || overallPerformance === null) fail("overallPerformance required.");
  if (typeof overallPerformance !== "number" || !Number.isFinite(overallPerformance)) fail("overallPerformance must be finite number.");

  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const report = {
    reportId: String(reportId),
    companyId: companyId === undefined ? null : companyId === null ? null : String(companyId),
    generatedAt: String(generatedAt),
    summary: String(summary ?? ""),
    overallPerformance: Number(overallPerformance),
    kpis: deepFreeze(safeArray(kpis)),
    trends: deepFreeze(safeArray(trends)),
    insights: deepFreeze(safeArray(insights)),
    recommendations: deepFreeze(safeArray(recommendations)),
    metrics: deepFreeze(safeArray(metrics)),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(report);
}

