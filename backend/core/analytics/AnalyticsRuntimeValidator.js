import { SUPPORTED_METRIC_CATEGORIES, SUPPORTED_AGGREGATIONS } from "./AnalyticsMetric.js";

function fail(message) {
  throw new Error(`AnalyticsRuntimeValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateAnalyticsRuntime(runtime) {
  const state = runtime?._state ?? runtime;
  if (!state || typeof state !== "object") fail("runtime state required.");
  if (!Object.isFrozen(state)) fail("analytics runtime state must be frozen.");

  const { metrics, dataPoints, derivedMetrics } = state;
  if (!Array.isArray(metrics)) fail("metrics must be array.");
  if (!Array.isArray(dataPoints)) fail("dataPoints must be array.");
  if (!derivedMetrics || typeof derivedMetrics !== "object") fail("derivedMetrics must be object.");

  const metricIds = new Set();
  for (const m of metrics) {
    if (!m || typeof m !== "object") fail("metric must be object.");
    if (!m.id) fail("metric.id required.");
    const mid = String(m.id);
    if (metricIds.has(mid)) fail(`duplicate metric id: ${mid}`);
    metricIds.add(mid);

    if (typeof m.name !== "string") fail("metric.name must be string.");
    if (typeof m.description !== "string") fail("metric.description must be string.");
    if (!SUPPORTED_METRIC_CATEGORIES.includes(String(m.category))) fail(`metric.category unsupported: ${String(m.category)}`);
    if (typeof m.unit !== "string") fail("metric.unit must be string.");
    if (!SUPPORTED_AGGREGATIONS.includes(String(m.aggregationType))) fail("metric.aggregationType unsupported.");
    if (!Array.isArray(m.dimensions)) fail("metric.dimensions must be array.");
    if (!m.metadata || typeof m.metadata !== "object") fail("metric.metadata must be object.");
  }

  const dpIds = new Set();
  for (const d of dataPoints) {
    if (!d || typeof d !== "object") fail("dataPoint must be object.");
    if (!d.id) fail("dataPoint.id required.");
    const did = String(d.id);
    if (dpIds.has(did)) fail(`duplicate dataPoint id: ${did}`);
    dpIds.add(did);

    if (typeof d.metricId !== "string") fail("dataPoint.metricId must be string.");
    const mid = String(d.metricId);
    if (!metricIds.has(mid)) fail(`dataPoint.metricId missing metric: ${mid}`);

    if (typeof d.value !== "number" || !Number.isFinite(d.value)) fail("dataPoint.value must be finite number.");
    if (typeof d.timestamp !== "string") fail("dataPoint.timestamp must be string.");
    if (!Array.isArray(d.dimensions)) fail("dataPoint.dimensions must be array.");
  }

  // derivedMetrics should be frozen for determinism.
  if (!Object.isFrozen(derivedMetrics)) fail("derivedMetrics must be frozen.");
  if (!derivedMetrics.runtimeMetrics || typeof derivedMetrics.runtimeMetrics !== "object") fail("derivedMetrics.runtimeMetrics must be object.");
  if (!Object.isFrozen(derivedMetrics.runtimeMetrics)) fail("derivedMetrics.runtimeMetrics must be frozen.");
  if (!derivedMetrics.derivedMetrics || typeof derivedMetrics.derivedMetrics !== "object") fail("derivedMetrics.derivedMetrics must be object.");
  if (!Object.isFrozen(derivedMetrics.derivedMetrics)) fail("derivedMetrics.derivedMetrics must be frozen.");

  return { ok: true };
}

