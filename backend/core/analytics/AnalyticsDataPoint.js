import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsDataPoint: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function validateDimensions(metricDimensions, datapointDimensions) {
  const allowed = new Set(Array.isArray(metricDimensions) ? metricDimensions.map((d) => String(d.id)) : []);
  const dims = Array.isArray(datapointDimensions) ? datapointDimensions : [];

  for (const d of dims) {
    const did = safeString(d?.dimensionId ?? d?.id);
    if (!did) fail("datapoint dimension dimensionId required.");
    if (allowed.size > 0 && !allowed.has(did)) fail(`datapoint dimensionId not part of metric dimensions: ${did}`);
  }

  return deepFreeze(
    dims.map((d) =>
      deepFreeze({
        dimensionId: safeString(d?.dimensionId ?? d?.id),
        value: d?.value === undefined ? null : d?.value,
      }),
    ),
  );
}

export function createAnalyticsDataPoint({
  id,
  metricId,
  value,
  timestamp,
  dimensions,
  sourceEventId,
  sourceObject,
  metadata,
  metricDimensionsForValidation = null,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!metricId || typeof metricId !== "string") fail("metricId required.");
  if (typeof value !== "number" || !Number.isFinite(value)) fail("value must be finite number.");
  if (!timestamp || typeof timestamp !== "string") fail("timestamp required ISO string.");

  const md = metadata && isPlainObject(metadata) ? metadata : {};
  const mdFrozen = deepFreeze(md);

  const dimsFrozen = validateDimensions(metricDimensionsForValidation ?? [], dimensions);

  const dp = deepFreeze({
    id: safeString(id),
    metricId: safeString(metricId),
    value,
    timestamp: safeString(timestamp),
    dimensions: dimsFrozen,
    sourceEventId: sourceEventId ? safeString(sourceEventId) : null,
    sourceObject: sourceObject && isPlainObject(sourceObject) ? deepFreeze(sourceObject) : deepFreeze({}),
    metadata: mdFrozen,
  });

  return dp;
}

