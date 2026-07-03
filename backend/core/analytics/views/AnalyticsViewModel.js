import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsViewModel: ${message}`);
}

export function createAnalyticsViewModel({
  viewId,
  companyId,
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
  if (!viewId || typeof viewId !== "string") fail("viewId required string.");
  if (!companyId || typeof companyId !== "string") fail("companyId required string.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required string.");
  if (typeof summary !== "string") fail("summary required string.");
  if (overallPerformance === undefined || overallPerformance === null) fail("overallPerformance required number.");
  if (typeof overallPerformance !== "number" || !Number.isFinite(overallPerformance)) fail("overallPerformance must be finite number.");
  if (!Array.isArray(kpis)) fail("kpis must be array.");
  if (!Array.isArray(trends)) fail("trends must be array.");
  if (!Array.isArray(insights)) fail("insights must be array.");
  if (!Array.isArray(recommendations)) fail("recommendations must be array.");
  if (!metrics || typeof metrics !== "object") fail("metrics must be object.");
  if (!metadata || typeof metadata !== "object") fail("metadata must be object.");

  const vm = {
    viewId,
    companyId,
    generatedAt,
    summary,
    overallPerformance,
    kpis: deepFreeze(kpis),
    trends: deepFreeze(trends),
    insights: deepFreeze(insights),
    recommendations: deepFreeze(recommendations),
    metrics: deepFreeze(metrics),
    metadata: deepFreeze(metadata),
  };

  return deepFreeze(vm);
}

