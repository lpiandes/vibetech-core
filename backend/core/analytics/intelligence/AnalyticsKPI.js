import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsKPI: ${message}`);
}

export function createAnalyticsKPI({
  kpiId,
  name,
  category,
  value,
  unit,
  meaning,
  metricId,
  metadata,
} = {}) {
  if (!kpiId) fail("kpiId required.");
  if (!name) fail("name required.");
  if (!category) fail("category required.");
  if (value === undefined || value === null || typeof value !== "number" || !Number.isFinite(value)) fail("value must be finite number.");
  if (!unit) fail("unit required.");
  const kpi = {
    kpiId: String(kpiId),
    name: String(name),
    category: String(category),
    value: Number(value),
    unit: String(unit),
    meaning: String(meaning ?? ""),
    metricId: metricId === undefined ? null : metricId === null ? null : String(metricId),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(kpi);
}

