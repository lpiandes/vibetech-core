import assert from "node:assert/strict";
import { test } from "node:test";

import { AnalyticsRuntime } from "./AnalyticsRuntime.js";
import { ANALYTICS_EVENT_TYPES } from "./AnalyticsEventTypes.js";

import { buildAnalyticsMetricForSeed, buildAnalyticsDataPointForSeed } from "./AnalyticsBuilder.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:10:00.000Z";
const NOW2 = "2026-07-01T00:20:00.000Z";

function makeMetric({ id = "m_req_total", aggregationType = "sum", dimensions = [] } = {}) {
  return buildAnalyticsMetricForSeed({
    id,
    category: "requests",
    unit: "count",
    aggregationType,
    dimensions,
    overrides: {},
  });
}

test("AnalyticsRuntime: runtime creation is immutable and metrics are zero", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });
  const state = rt._state;

  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(rt.getMetrics()));
  assert.equal(state.metrics.length, 0);
  assert.equal(state.dataPoints.length, 0);

  const derived = rt.getDerivedMetrics();
  assert.equal(derived.runtimeMetrics.totalMetrics, 0);
  assert.equal(derived.runtimeMetrics.activeMetrics, 0);
  assert.equal(derived.runtimeMetrics.totalDataPoints, 0);
  assert.ok(Object.isFrozen(derived));
});

test("Metric registration: ANALYTICS_METRIC_REGISTERED adds metric and updates derived runtime metrics", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });

  const metric = makeMetric();

  rt.applyEvent({
    id: "evt_m_register_1",
    timestampISO: NOW0,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
    source: "test",
    payload: { metric },
  });

  const m = rt.getMetric("m_req_total");
  assert.ok(m);
  assert.equal(m.name, "Deterministic Metric");

  const derived = rt.getDerivedMetrics();
  assert.equal(derived.runtimeMetrics.totalMetrics, 1);
  assert.equal(derived.runtimeMetrics.activeMetrics, 1);
  assert.equal(derived.runtimeMetrics.totalDataPoints, 0);
});

test("Data point recording: derived sum aggregate updates", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });

  const metric = makeMetric({ aggregationType: "sum" });
  rt.applyEvent({
    id: "evt_m_register_sum_1",
    timestampISO: NOW0,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
    source: "test",
    payload: { metric },
  });

  const dp1 = buildAnalyticsDataPointForSeed({
    id: "dp_1",
    metricId: metric.id,
    value: 10,
    timestamp: NOW1,
    dimensions: [],
    metricDimensionsForValidation: metric.dimensions,
  });

  rt.applyEvent({
    id: "evt_dp_rec_1",
    timestampISO: NOW1,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
    source: "test",
    payload: { dataPoint: dp1 },
  });

  const derived1 = rt.getDerivedMetrics();
  assert.equal(derived1.runtimeMetrics.totalDataPoints, 1);
  assert.equal(derived1.derivedMetrics[metric.id].value, 10);

  const dp2 = buildAnalyticsDataPointForSeed({
    id: "dp_2",
    metricId: metric.id,
    value: 7,
    timestamp: NOW2,
    dimensions: [],
    metricDimensionsForValidation: metric.dimensions,
  });

  rt.applyEvent({
    id: "evt_dp_rec_2",
    timestampISO: NOW2,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
    source: "test",
    payload: { dataPoint: dp2 },
  });

  const derived2 = rt.getDerivedMetrics();
  assert.equal(derived2.runtimeMetrics.totalDataPoints, 2);
  assert.equal(derived2.derivedMetrics[metric.id].value, 17);
});

test("Data point correction: derived aggregate updates and preserves immutability", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });
  const metric = makeMetric({ aggregationType: "sum" });

  rt.applyEvent({
    id: "evt_m_register_1",
    timestampISO: NOW0,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
    source: "test",
    payload: { metric },
  });

  const dp = buildAnalyticsDataPointForSeed({
    id: "dp_c",
    metricId: metric.id,
    value: 5,
    timestamp: NOW1,
    dimensions: [],
    metricDimensionsForValidation: metric.dimensions,
  });

  rt.applyEvent({
    id: "evt_dp_rec_c",
    timestampISO: NOW1,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
    source: "test",
    payload: { dataPoint: dp },
  });

  const derived1 = rt.getDerivedMetrics();
  assert.equal(derived1.derivedMetrics[metric.id].value, 5);

  const corrected = buildAnalyticsDataPointForSeed({
    id: "dp_c",
    metricId: metric.id,
    value: 11,
    timestamp: NOW2,
    dimensions: [],
    metricDimensionsForValidation: metric.dimensions,
  });

  rt.applyEvent({
    id: "evt_dp_corr_c",
    timestampISO: NOW2,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_CORRECTED,
    source: "test",
    payload: { dataPoint: corrected },
  });

  const derived2 = rt.getDerivedMetrics();
  assert.equal(derived2.derivedMetrics[metric.id].value, 11);
  assert.ok(Object.isFrozen(rt.getDataPoints()));
});

test("Metric archive: activeMetrics decreases and derivedMetrics excludes archived metric", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });
  const metric = makeMetric({ id: "m_archive_1", aggregationType: "latest" });

  rt.applyEvent({
    id: "evt_m_register_a",
    timestampISO: NOW0,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
    source: "test",
    payload: { metric },
  });

  const dp = buildAnalyticsDataPointForSeed({
    id: "dp_a1",
    metricId: metric.id,
    value: 123,
    timestamp: NOW1,
    dimensions: [],
    metricDimensionsForValidation: metric.dimensions,
  });

  rt.applyEvent({
    id: "evt_dp_rec_a",
    timestampISO: NOW1,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_DATA_POINT_RECORDED,
    source: "test",
    payload: { dataPoint: dp },
  });

  assert.equal(rt.getDerivedMetrics().runtimeMetrics.activeMetrics, 1);
  assert.equal(rt.getDerivedMetrics().derivedMetrics[metric.id].value, 123);

  rt.applyEvent({
    id: "evt_m_archive_a",
    timestampISO: NOW2,
    type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_ARCHIVED,
    source: "test",
    payload: { metricId: metric.id },
  });

  const derived = rt.getDerivedMetrics();
  assert.equal(derived.runtimeMetrics.activeMetrics, 0);
  assert.equal(derived.derivedMetrics[metric.id], undefined);
});

test("Validation: invalid category registration throws", () => {
  const rt = new AnalyticsRuntime({ nowISO: NOW0 });

  const badMetric = {
    id: "m_bad_1",
    name: "Bad",
    description: "bad",
    category: "not_a_category",
    unit: "count",
    aggregationType: "count",
    dimensions: [],
    metadata: {},
  };

  assert.throws(() =>
    rt.applyEvent({
      id: "evt_m_register_bad",
      timestampISO: NOW0,
      type: ANALYTICS_EVENT_TYPES.ANALYTICS_METRIC_REGISTERED,
      source: "test",
      payload: { metric: badMetric },
    }),
  );
});

