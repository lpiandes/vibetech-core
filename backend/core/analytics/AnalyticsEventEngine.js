import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import {
  ANALYTICS_EVENT_TYPES,
  SUPPORTED_ANALYTICS_EVENT_TYPES,
} from "./AnalyticsEventTypes.js";

import { createAnalyticsMetric } from "./AnalyticsMetric.js";
import { createAnalyticsDataPoint } from "./AnalyticsDataPoint.js";

import { computeAnalyticsDerivedMetrics } from "./AnalyticsMetrics.js";

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") throw new Error(`AnalyticsEventEngine: expected ${name} to be a string.`);
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function findById(items, id) {
  const sid = String(id);
  return items.find((x) => String(x?.id) === sid) ?? null;
}

export class AnalyticsEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("AnalyticsEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    if (!event || typeof event !== "object") throw new Error("AnalyticsEventEngine: event must be an object.");
    requireString(event.id, "event.id");
    requireString(event.timestampISO, "event.timestampISO");
    requireString(event.type, "event.type");
    requireString(event.source, "event.source");

    if (!isPlainObject(event.payload)) throw new Error("AnalyticsEventEngine: event.payload must be a plain object.");
    if (!SUPPORTED_ANALYTICS_EVENT_TYPES.includes(event.type)) {
      throw new Error(`AnalyticsEventEngine: Unsupported event type: ${event.type}`);
    }

    const prev = this.runtime._state;
    let metrics = safeClone(prev.metrics);
    let dataPoints = safeClone(prev.dataPoints);

    const payload = event.payload;

    switch (event.type) {
      case ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED: {
        const { metric } = payload;
        if (!isPlainObject(metric)) throw new Error("ANALYTICS_METRIC_REGISTERED: metric payload required.");
        const created = createAnalyticsMetric(metric);
        if (metrics.some((m) => String(m.id) === String(created.id))) {
          throw new Error("ANALYTICS_METRIC_REGISTERED: metric already exists.");
        }
        metrics.push(created);
        break;
      }

      case ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED: {
        const { dataPoint } = payload;
        if (!isPlainObject(dataPoint)) throw new Error("ANALYTICS_DATA_POINT_RECORDED: dataPoint payload required.");
        const metric = findById(metrics, dataPoint.metricId);
        if (!metric) throw new Error("ANALYTICS_DATA_POINT_RECORDED: metric does not exist.");
        const created = createAnalyticsDataPoint({
          ...dataPoint,
          metricDimensionsForValidation: metric.dimensions,
        });
        if (dataPoints.some((d) => String(d.id) === String(created.id))) {
          throw new Error("ANALYTICS_DATA_POINT_RECORDED: dataPoint already exists.");
        }
        dataPoints.push(created);
        break;
      }

      case ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_CORRECTED: {
        const { dataPoint } = payload;
        if (!isPlainObject(dataPoint)) throw new Error("ANALYTICS_DATA_POINT_CORRECTED: dataPoint payload required.");
        const tmpCreated = createAnalyticsDataPoint(dataPoint);
        const metric = findById(metrics, tmpCreated.metricId);
        if (!metric) throw new Error("ANALYTICS_DATA_POINT_CORRECTED: metric does not exist.");
        const created = createAnalyticsDataPoint({
          ...dataPoint,
          metricDimensionsForValidation: metric.dimensions,
        });
        const idx = dataPoints.findIndex((d) => String(d.id) === String(created.id));
        if (idx === -1) throw new Error("ANALYTICS_DATA_POINT_CORRECTED: dataPoint does not exist.");
        dataPoints[idx] = created;
        break;
      }

      case ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_ARCHIVED: {
        const { metricId } = payload;
        if (!metricId) throw new Error("ANALYTICS_METRIC_ARCHIVED: metricId required.");
        const idx = metrics.findIndex((m) => String(m.id) === String(metricId));
        if (idx === -1) throw new Error("ANALYTICS_METRIC_ARCHIVED: metric does not exist.");
        const prevMetric = metrics[idx];
        const nextMetric = createAnalyticsMetric({
          ...prevMetric,
          metadata: {
            ...(prevMetric.metadata ?? {}),
            archivedAt: event.timestampISO,
          },
        });
        metrics[idx] = nextMetric;
        break;
      }

      default:
        throw new Error(`AnalyticsEventEngine: Unhandled event type: ${event.type}`);
    }

    const derivedMetrics = computeAnalyticsDerivedMetrics({ metrics, dataPoints });

    const nextMetrics = metrics.map((m) => createAnalyticsMetric(m));
    const nextDataPoints = dataPoints.map((d) => createAnalyticsDataPoint(d));

    this.runtime._state = deepFreeze({
      metrics: deepFreeze(nextMetrics),
      dataPoints: deepFreeze(nextDataPoints),
      derivedMetrics: deepFreeze(derivedMetrics),
    });

    return this.runtime._state;
  }
}

