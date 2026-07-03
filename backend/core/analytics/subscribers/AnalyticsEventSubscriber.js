import { createPlatformEventSubscriberFromHandler } from "../../events/subscribers/PlatformEventSubscriberFactory.js";

import { ANALYTICS_EVENT_TYPES } from "../AnalyticsEventTypes.js";

import { mapPlatformEventToAnalyticsDataPoint } from "./AnalyticsEventMapper.js";
import { validateAnalyticsDataPointForRecording, validateAnalyticsMetricRegistration } from "./AnalyticsEventValidator.js";
import { ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT, DEFAULT_METRIC_DEFINITION } from "./AnalyticsEventDefaults.js";

import { createAnalyticsMetric } from "../AnalyticsMetric.js";

import { SUBSCRIBER_RESULT_STATUSES } from "../../events/subscribers/PlatformEventSubscriberDefaults.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

function deterministicAnalyticsMetricEventId({ metricId }) {
  return `evt_analytics_metric_reg_${safeString(metricId)}`;
}

function deterministicAnalyticsDataPointEventId({ dataPointId }) {
  return `evt_analytics_dp_rec_${safeString(dataPointId)}`;
}

export function createAnalyticsEventSubscriber({
  id,
  name,
  operatingSystem = "analytics_event_subscribers",
  analyticsRuntime,
  supportedEvents,
  priority = 0,
  enabled = true,
} = {}) {
  if (!analyticsRuntime) throw new Error("createAnalyticsEventSubscriber requires analyticsRuntime.");

  const subscriberSupportedEvents = supportedEvents ?? Object.keys(ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT);

  return createPlatformEventSubscriberFromHandler({
    id: String(id ?? "sub_analytics_event"),
    name: String(name ?? "AnalyticsEventSubscriber"),
    operatingSystem: String(operatingSystem),
    supportedEvents: subscriberSupportedEvents,
    priority,
    enabled,
    handler: (event, context = {}) => {
      const runtime = context.analyticsRuntime ?? analyticsRuntime;
      if (!runtime) {
        return {
          status: SUBSCRIBER_RESULT_STATUSES.FAILED,
          message: "AnalyticsRuntime missing in subscriber context.",
          actions: [],
          errors: ["AnalyticsRuntime required."],
          metadata: {},
        };
      }

      const mapped = mapPlatformEventToAnalyticsDataPoint(event, { nowISO: runtime.nowISO ?? context.nowISO });
      if (!mapped) {
        return {
          status: SUBSCRIBER_RESULT_STATUSES.SKIPPED,
          message: "Event not supported by AnalyticsEventSubscriber.",
          actions: [],
          errors: [],
          metadata: { derivedFrom: { skipped: true, eventType: String(event?.eventType ?? "") } },
        };
      }

      const { metricId, dataPoint } = mapped;
      validateAnalyticsDataPointForRecording({ dataPoint });

      try {
        // Ensure metric exists (runtime requires it).
        const existing = runtime.getMetric?.(metricId) ?? null;
        if (!existing) {
          const def = ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT[String(event.eventType)];
          const metric = createAnalyticsMetric({
            id: metricId,
            name: def.name,
            description: `Deterministic metric for ${String(event.eventType)}.`,
            category: def.category,
            unit: DEFAULT_METRIC_DEFINITION.unit,
            aggregationType: DEFAULT_METRIC_DEFINITION.aggregationType,
            dimensions: DEFAULT_METRIC_DEFINITION.dimensions,
            metadata: DEFAULT_METRIC_DEFINITION.metadata,
          });
          validateAnalyticsMetricRegistration({ metric });

          runtime.applyEvent({
            id: deterministicAnalyticsMetricEventId({ metricId }),
            timestampISO: String(event?.occurredAt ?? context.nowISO ?? runtime.nowISO ?? "2026-07-01T00:00:00.000Z"),
            type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
            source: "analytics_event_subscriber",
            payload: { metric },
          });
        }

        const alreadyRecorded = safeString(dataPoint?.id ?? "") && runtime.getDataPoints?.().some((d) => String(d.id) === String(dataPoint.id));
        if (!alreadyRecorded) {
          runtime.applyEvent({
            id: deterministicAnalyticsDataPointEventId({ dataPointId: dataPoint.id }),
            timestampISO: String(event?.occurredAt ?? context.nowISO ?? runtime.nowISO ?? "2026-07-01T00:00:00.000Z"),
            type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
            source: "analytics_event_subscriber",
            payload: { dataPoint },
          });
        }

        return {
          status: SUBSCRIBER_RESULT_STATUSES.SUCCESS,
          message: "",
          actions: [],
          errors: [],
          metadata: {
            derivedFrom: { eventId: safeString(event?.eventId), eventType: safeString(event?.eventType), metricId },
          },
        };
      } catch (err) {
        return {
          status: SUBSCRIBER_RESULT_STATUSES.FAILED,
          message: String(err?.message ?? err),
          actions: [],
          errors: [String(err?.message ?? err)],
          metadata: { derivedFrom: { eventId: safeString(event?.eventId), eventType: safeString(event?.eventType), metricId } },
        };
      }
    },
    handlerMetadata: { version: 1 },
  });
}

export function analyticsEventHandle(event, context = {}) {
  // Optional: for direct unit-testing without bus subscriber wrapper.
  const runtime = context.analyticsRuntime;
  if (!runtime) throw new Error("analyticsEventHandle requires analyticsRuntime in context.");

  const mapped = mapPlatformEventToAnalyticsDataPoint(event, { nowISO: context.nowISO });
  if (!mapped) {
    return {
      status: SUBSCRIBER_RESULT_STATUSES.SKIPPED,
      message: "Event not supported by AnalyticsEventSubscriber.",
      actions: [],
      errors: [],
      metadata: {},
    };
  }

  const { metricId, dataPoint } = mapped;
  validateAnalyticsDataPointForRecording({ dataPoint });

  const def = ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT[String(event.eventType)];

  const existing = runtime.getMetric?.(metricId) ?? null;
  if (!existing) {
    const metric = createAnalyticsMetric({
      id: metricId,
      name: def.name,
      description: `Deterministic metric for ${String(event.eventType)}.`,
      category: def.category,
      unit: DEFAULT_METRIC_DEFINITION.unit,
      aggregationType: DEFAULT_METRIC_DEFINITION.aggregationType,
      dimensions: DEFAULT_METRIC_DEFINITION.dimensions,
      metadata: DEFAULT_METRIC_DEFINITION.metadata,
    });
    runtime.applyEvent({
      id: deterministicAnalyticsMetricEventId({ metricId }),
      timestampISO: String(event?.occurredAt ?? context.nowISO ?? "2026-07-01T00:00:00.000Z"),
      type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
      source: "analytics_event_subscriber",
      payload: { metric },
    });
  }

  const alreadyRecorded = safeString(dataPoint?.id ?? "") && runtime.getDataPoints?.().some((d) => String(d.id) === String(dataPoint.id));
  if (!alreadyRecorded) {
    runtime.applyEvent({
      id: deterministicAnalyticsDataPointEventId({ dataPointId: dataPoint.id }),
      timestampISO: String(event?.occurredAt ?? context.nowISO ?? "2026-07-01T00:00:00.000Z"),
      type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
      source: "analytics_event_subscriber",
      payload: { dataPoint },
    });
  }

  return {
    status: SUBSCRIBER_RESULT_STATUSES.SUCCESS,
    message: "",
    actions: [],
    errors: [],
    metadata: {},
  };
}

