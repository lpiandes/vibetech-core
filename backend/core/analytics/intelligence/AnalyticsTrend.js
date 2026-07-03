import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { TREND_DIRECTIONS } from "./AnalyticsIntelligenceDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsTrend: ${message}`);
}

export function createAnalyticsTrend({
  trendId,
  kpiId,
  metricId = null,
  direction,
  previousValue,
  currentValue,
  note,
} = {}) {
  if (!trendId) fail("trendId required.");
  if (!kpiId) fail("kpiId required.");
  if (!TREND_DIRECTIONS.includes(String(direction))) fail(`direction invalid: ${String(direction)}`);
  const trend = {
    trendId: String(trendId),
    kpiId: String(kpiId),
    metricId: metricId === undefined ? null : metricId === null ? null : String(metricId),
    direction: String(direction),
    previousValue: previousValue === undefined ? null : Number(previousValue),
    currentValue: currentValue === undefined ? null : Number(currentValue),
    note: String(note ?? ""),
  };
  return deepFreeze(trend);
}

