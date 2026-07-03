import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createAnalyticsDimension } from "./AnalyticsDimension.js";
import { createAnalyticsMetric } from "./AnalyticsMetric.js";
import { createAnalyticsDataPoint } from "./AnalyticsDataPoint.js";
import { computeAnalyticsDerivedMetrics } from "./AnalyticsMetrics.js";

export function buildAnalyticsRuntimeSeed() {
  const metrics = deepFreeze([]);
  const dataPoints = deepFreeze([]);
  const derivedMetrics = computeAnalyticsDerivedMetrics({ metrics, dataPoints });
  return deepFreeze({ metrics, dataPoints, derivedMetrics });
}

export function buildAnalyticsMetricForSeed({
  id = "m_1",
  overrides = {},
  category = "operations",
  unit = "count",
  aggregationType = "count",
  dimensions = [],
} = {}) {
  return createAnalyticsMetric({
    id,
    name: "Deterministic Metric",
    description: "A deterministic analytics metric seed.",
    category,
    unit,
    aggregationType,
    dimensions,
    metadata: {},
    ...overrides,
  });
}

export function buildAnalyticsDataPointForSeed({
  id = "dp_1",
  metricId = "m_1",
  value = 1,
  timestamp = "2026-07-01T00:00:00.000Z",
  dimensions = [],
  sourceEventId = "evt_1",
  sourceObject = {},
  metadata = {},
  metricDimensionsForValidation = [],
} = {}) {
  // Metric dimensions for validation are passed through to datapoint factory.
  return createAnalyticsDataPoint({
    id,
    metricId,
    value,
    timestamp,
    dimensions,
    sourceEventId,
    sourceObject,
    metadata,
    metricDimensionsForValidation,
  });
}

