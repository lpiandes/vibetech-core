import assert from "node:assert/strict";
import { test } from "node:test";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { AnalyticsRuntime } from "../AnalyticsRuntime.js";
import { buildAnalyticsDataPointForSeed, buildAnalyticsMetricForSeed } from "../AnalyticsBuilder.js";
import { computeAnalyticsDerivedMetrics } from "../AnalyticsMetrics.js";

import { AnalyticsIntelligenceEngine } from "./AnalyticsIntelligenceEngine.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeRuntimeSeed({ metrics, dataPoints }) {
  const derivedMetrics = computeAnalyticsDerivedMetrics({ metrics, dataPoints });
  return deepFreeze({ metrics, dataPoints, derivedMetrics });
}

function makeDataPoint({ id, metricId, timestampISO, value = 1 } = {}) {
  return buildAnalyticsDataPointForSeed({
    id,
    metricId,
    timestamp: timestampISO,
    value,
    dimensions: [],
    sourceEventId: "evt_unit",
    sourceObject: {},
    metadata: {},
    metricDimensionsForValidation: [],
  });
}

function makeMetric({ id, category } = {}) {
  return buildAnalyticsMetricForSeed({
    id,
    category,
    aggregationType: "count",
    dimensions: [],
    unit: "count",
    metadata: {},
  });
}

function getValueByKpiId(report, kpiId) {
  const k = report.kpis.find((x) => String(x.kpiId) === String(kpiId));
  return k?.value ?? null;
}

function getTrendByKpiId(report, kpiId) {
  const t = report.trends.find((x) => String(x.kpiId) === String(kpiId));
  return t?.direction ?? null;
}

test("AnalyticsIntelligenceEngine: generates immutable report + deterministic KPI values", () => {
  const metrics = [
    makeMetric({ id: "request_received_count", category: "requests" }),
    makeMetric({ id: "request_converted_count", category: "requests" }),
    makeMetric({ id: "work_created_count", category: "work" }),
    makeMetric({ id: "work_completed_count", category: "work" }),
    makeMetric({ id: "communication_sent_count", category: "communications" }),
    makeMetric({ id: "communication_failed_count", category: "communications" }),
    makeMetric({ id: "team_member_created_count", category: "team" }),
    makeMetric({ id: "team_member_archived_count", category: "team" }),
    makeMetric({ id: "capability_registered_count", category: "capabilities" }),
    makeMetric({ id: "capability_archived_count", category: "capabilities" }),
  ];

  const dataPoints = [
    // request_received_count: 2 datapoints => KPI uses length (=2), trend uses value sum (1 vs 2) => improving.
    makeDataPoint({ id: "dp_rr_1", metricId: "request_received_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_rr_2", metricId: "request_received_count", timestampISO: "2026-06-30T00:00:00.000Z", value: 2 }),

    makeDataPoint({ id: "dp_rcv_1", metricId: "request_converted_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_wc_1", metricId: "work_created_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_wc_2", metricId: "work_created_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),

    // work_completed_count: 1 datapoint => completionRate = 1/2, trend will be unknown.
    makeDataPoint({ id: "dp_wcm_1", metricId: "work_completed_count", timestampISO: "2026-06-30T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_cs_1", metricId: "communication_sent_count", timestampISO: "2026-06-05T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_cs_2", metricId: "communication_sent_count", timestampISO: "2026-06-25T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_cf_1", metricId: "communication_failed_count", timestampISO: "2026-06-15T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_tcr_1", metricId: "team_member_created_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_tcr_2", metricId: "team_member_created_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_tar_1", metricId: "team_member_archived_count", timestampISO: "2026-06-15T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_capreg_1", metricId: "capability_registered_count", timestampISO: "2026-06-10T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_caparch_1", metricId: "capability_archived_count", timestampISO: "2026-06-25T00:00:00.000Z", value: 1 }),
  ];

  const seed = () => makeRuntimeSeed({ metrics, dataPoints });
  const analyticsRuntime = new AnalyticsRuntime({ seed, nowISO: NOW0 });

  const engine = new AnalyticsIntelligenceEngine({ nowISO: NOW0 });
  const snapshotBefore = JSON.stringify({
    metrics: analyticsRuntime.getMetrics?.(),
    dataPoints: analyticsRuntime.getDataPoints?.(),
    derivedMetrics: analyticsRuntime.getDerivedMetrics?.(),
  });

  const report = engine.generate({ analyticsRuntime, companyId: "co_1", nowISO: NOW0 });

  const snapshotAfter = JSON.stringify({
    metrics: analyticsRuntime.getMetrics?.(),
    dataPoints: analyticsRuntime.getDataPoints?.(),
    derivedMetrics: analyticsRuntime.getDerivedMetrics?.(),
  });

  assert.equal(snapshotAfter, snapshotBefore, "AnalyticsRuntime must not be mutated by intelligence engine.");

  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.kpis[0]));
  assert.ok(Object.isFrozen(report.trends[0]));
  assert.ok(Object.isFrozen(report.insights[0]));
  assert.ok(Object.isFrozen(report.recommendations[0]));

  // KPI assertions.
  assert.equal(getValueByKpiId(report, "request_volume"), 2);
  assert.equal(getValueByKpiId(report, "request_conversion_count"), 1);
  assert.equal(getValueByKpiId(report, "work_created_count"), 2);
  assert.equal(getValueByKpiId(report, "work_completed_count"), 1);
  assert.equal(getValueByKpiId(report, "communication_success_count"), 2);
  assert.equal(getValueByKpiId(report, "communication_failure_count"), 1);
  assert.equal(getValueByKpiId(report, "team_growth_net"), 1);
  assert.equal(getValueByKpiId(report, "capability_growth_net"), 0);

  // Trend assertions.
  assert.equal(getTrendByKpiId(report, "request_volume"), "improving");
  assert.equal(getTrendByKpiId(report, "work_completed_count"), "unknown");

  // Overall performance deterministic.
  assert.equal(report.overallPerformance, 56);
});

test("AnalyticsIntelligenceEngine: insight + recommendation generation triggers deterministic thresholds", () => {
  const metrics = [
    makeMetric({ id: "request_received_count", category: "requests" }),
    makeMetric({ id: "request_converted_count", category: "requests" }),
    makeMetric({ id: "work_created_count", category: "work" }),
    makeMetric({ id: "work_completed_count", category: "work" }),
    makeMetric({ id: "communication_sent_count", category: "communications" }),
    makeMetric({ id: "communication_failed_count", category: "communications" }),
    makeMetric({ id: "team_member_created_count", category: "team" }),
    makeMetric({ id: "team_member_archived_count", category: "team" }),
    makeMetric({ id: "capability_registered_count", category: "capabilities" }),
    makeMetric({ id: "capability_archived_count", category: "capabilities" }),
  ];

  const dataPoints = [
    makeDataPoint({ id: "dp_rr_1", metricId: "request_received_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_rr_2", metricId: "request_received_count", timestampISO: "2026-06-10T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_rc_1", metricId: "request_converted_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_wc_1", metricId: "work_created_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_wc_2", metricId: "work_created_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),

    // Only 1 completed datapoint => completionRate = 1/2 => backlog insight.
    makeDataPoint({ id: "dp_wcom_1", metricId: "work_completed_count", timestampISO: "2026-06-25T00:00:00.000Z", value: 1 }),

    // success rate below 0.7 to trigger communication failures insight (sent=1, failed=1 => 0.5).
    makeDataPoint({ id: "dp_cs_1", metricId: "communication_sent_count", timestampISO: "2026-06-05T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_cf_1", metricId: "communication_failed_count", timestampISO: "2026-06-15T00:00:00.000Z", value: 1 }),

    makeDataPoint({ id: "dp_tcr_1", metricId: "team_member_created_count", timestampISO: "2026-06-01T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_tcr_2", metricId: "team_member_created_count", timestampISO: "2026-06-20T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_tar_1", metricId: "team_member_archived_count", timestampISO: "2026-06-25T00:00:00.000Z", value: 0 }),

    makeDataPoint({ id: "dp_capreg_1", metricId: "capability_registered_count", timestampISO: "2026-06-10T00:00:00.000Z", value: 1 }),
    makeDataPoint({ id: "dp_caparch_1", metricId: "capability_archived_count", timestampISO: "2026-06-25T00:00:00.000Z", value: 0 }),
  ];

  const seed = () => makeRuntimeSeed({ metrics, dataPoints });
  const analyticsRuntime = new AnalyticsRuntime({ seed, nowISO: NOW0 });

  const engine = new AnalyticsIntelligenceEngine({ nowISO: NOW0 });
  const report = engine.generate({ analyticsRuntime, companyId: "co_2", nowISO: NOW0 });

  const insightIds = report.insights.map((x) => String(x.insightId));
  assert.ok(insightIds.includes("insight_communication_failures"));
  assert.ok(insightIds.includes("insight_completion_backlog"));

  const recIds = report.recommendations.map((x) => String(x.recommendationId));
  assert.ok(recIds.includes("rec_investigate_communication_failures"));
  assert.ok(recIds.includes("rec_reduce_work_backlog"));
});

