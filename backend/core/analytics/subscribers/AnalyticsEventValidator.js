function fail(message) {
  throw new Error(`AnalyticsEventValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateAnalyticsDataPointForRecording({ dataPoint }) {
  if (!dataPoint || typeof dataPoint !== "object") fail("dataPoint required object.");
  if (!Object.isFrozen(dataPoint)) fail("dataPoint must be frozen/immutable.");

  if (!dataPoint.metricId || typeof dataPoint.metricId !== "string") fail("dataPoint.metricId required string.");
  if (typeof dataPoint.value !== "number" || !Number.isFinite(dataPoint.value)) fail("dataPoint.value must be finite number.");
  if (!dataPoint.timestamp || typeof dataPoint.timestamp !== "string") fail("dataPoint.timestamp required string.");

  if (!Array.isArray(dataPoint.dimensions)) fail("dataPoint.dimensions must be array.");
  for (const d of dataPoint.dimensions) {
    if (!d || typeof d !== "object") fail("dimension must be object.");
    if (!d.dimensionId || typeof d.dimensionId !== "string") fail("dimension.dimensionId required string.");
  }

  if (dataPoint.metadata !== undefined && !isPlainObject(dataPoint.metadata)) fail("dataPoint.metadata must be plain object.");
  return { ok: true };
}

export function validateAnalyticsMetricRegistration({ metric }) {
  if (!metric || typeof metric !== "object") fail("metric required object.");
  if (!Object.isFrozen(metric)) {
    // Metric is typically deep-frozen by createAnalyticsMetric; tolerate unfrozen for mapping stage.
  }
  if (!metric.id || typeof metric.id !== "string") fail("metric.id required string.");
  if (!metric.category || typeof metric.category !== "string") fail("metric.category required string.");
  return { ok: true };
}


