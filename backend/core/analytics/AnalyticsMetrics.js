import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function parseTimeMs(iso) {
  const t = new Date(String(iso)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isArchivedMetric(metric) {
  return Boolean(metric?.metadata?.archivedAt);
}

function computeAggregateForMetric({ metric, dataPoints }) {
  const activePoints = dataPoints.filter((d) => String(d.metricId) === String(metric.id));
  if (!activePoints.length) {
    return {
      metricId: String(metric.id),
      aggregationType: String(metric.aggregationType),
      value: 0,
      latestTimestamp: null,
      computedAtISO: null,
    };
  }

  const values = activePoints.map((d) => Number(d.value));
  const times = activePoints.map((d) => parseTimeMs(d.timestamp));
  const latestIdx = times.reduce((best, t, idx) => (t > times[best] ? idx : best), 0);
  const latest = activePoints[latestIdx];

  const aggType = String(metric.aggregationType);
  let v = 0;
  if (aggType === "count") v = activePoints.length;
  else if (aggType === "sum") v = values.reduce((a, x) => a + x, 0);
  else if (aggType === "average") v = values.reduce((a, x) => a + x, 0) / activePoints.length;
  else if (aggType === "min") v = Math.min(...values);
  else if (aggType === "max") v = Math.max(...values);
  else if (aggType === "latest") v = Number(latest.value);

  return {
    metricId: String(metric.id),
    aggregationType: aggType,
    value: v,
    latestTimestamp: latest?.timestamp ? String(latest.timestamp) : null,
    computedAtISO: null, // runtime will stamp computedAt later
  };
}

export function computeRuntimeMetrics({ metrics, dataPoints }) {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const safeDataPoints = Array.isArray(dataPoints) ? dataPoints : [];

  const totalMetrics = safeMetrics.length;
  const activeMetrics = safeMetrics.filter((m) => !isArchivedMetric(m)).length;
  const totalDataPoints = safeDataPoints.length;

  const dataPointsByMetric = {};
  for (const m of safeMetrics) dataPointsByMetric[String(m.id)] = 0;
  for (const d of safeDataPoints) {
    const mid = String(d.metricId);
    dataPointsByMetric[mid] = Number(dataPointsByMetric[mid] ?? 0) + 1;
  }

  const dataPointsByCategory = {};
  for (const m of safeMetrics) dataPointsByCategory[String(m.category)] = 0;
  for (const d of safeDataPoints) {
    const metric = safeMetrics.find((m) => String(m.id) === String(d.metricId));
    if (!metric) continue;
    const cat = String(metric.category);
    dataPointsByCategory[cat] = Number(dataPointsByCategory[cat] ?? 0) + 1;
  }

  return deepFreeze({
    totalMetrics,
    activeMetrics,
    totalDataPoints,
    dataPointsByMetric: deepFreeze(dataPointsByMetric),
    dataPointsByCategory: deepFreeze(dataPointsByCategory),
  });
}

export function computeAnalyticsDerivedMetrics({ metrics, dataPoints }) {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const safeDataPoints = Array.isArray(dataPoints) ? dataPoints : [];

  const runtimeMetrics = computeRuntimeMetrics({ metrics: safeMetrics, dataPoints: safeDataPoints });
  const derivedMetrics = {};

  for (const m of safeMetrics) {
    if (isArchivedMetric(m)) continue;
    const agg = computeAggregateForMetric({ metric: m, dataPoints: safeDataPoints });
    derivedMetrics[String(m.id)] = deepFreeze(agg);
  }

  return deepFreeze({
    runtimeMetrics,
    derivedMetrics,
  });
}

