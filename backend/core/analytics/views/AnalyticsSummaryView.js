import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsSummaryView: ${message}`);
}

export function createAnalyticsSummaryView({
  viewId,
  companyId,
  generatedAt,
  summary,
  overallPerformance,
  metadata,
} = {}) {
  if (!viewId || typeof viewId !== "string") fail("viewId required string.");
  if (!companyId || typeof companyId !== "string") fail("companyId required string.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required string.");
  if (typeof summary !== "string") fail("summary required string.");
  if (typeof overallPerformance !== "number" || !Number.isFinite(overallPerformance)) fail("overallPerformance required number.");

  const view = {
    viewId,
    companyId,
    generatedAt,
    summary,
    overallPerformance,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

