import assert from "node:assert/strict";
import { test } from "node:test";

import { AnalyticsRuntime } from "../AnalyticsRuntime.js";

import { createAnalyticsIntelligenceReport } from "../intelligence/AnalyticsIntelligenceReport.js";
import { createAnalyticsKPI } from "../intelligence/AnalyticsKPI.js";
import { createAnalyticsTrend } from "../intelligence/AnalyticsTrend.js";
import { createAnalyticsInsight } from "../intelligence/AnalyticsInsight.js";
import { createAnalyticsRecommendation } from "../intelligence/AnalyticsRecommendation.js";

import { AnalyticsViewAdapter } from "./AnalyticsViewAdapter.js";

const NOW0 = "2026-07-01T00:00:00.000Z";

function makeFrozenReport() {
  return createAnalyticsIntelligenceReport({
    reportId: "rep_1",
    companyId: "company_1",
    generatedAt: NOW0,
    summary: "Executive analytics summary",
    overallPerformance: 72,
    kpis: [
      createAnalyticsKPI({
        kpiId: "request_volume",
        name: "Request Volume",
        category: "requests",
        value: 0,
        unit: "count",
        meaning: "meaning",
        metricId: "request_received_count",
        metadata: {},
      }),
      createAnalyticsKPI({
        kpiId: "communication_failure_count",
        name: "Communication Failure",
        category: "communications",
        value: 5,
        unit: "count",
        meaning: "meaning",
        metricId: "communication_failed_count",
        metadata: {},
      }),
    ],
    trends: [
      createAnalyticsTrend({
        trendId: "trend_request_volume",
        kpiId: "request_volume",
        direction: "declining",
        previousValue: 2,
        currentValue: 1,
        note: "note",
      }),
    ],
    insights: [
      createAnalyticsInsight({
        insightId: "insight_communication_failures",
        category: "communications",
        title: "High communication failures",
        message: "Failures recorded",
        evidence: ["communication_failed_count=5"],
      }),
    ],
    recommendations: [
      createAnalyticsRecommendation({
        recommendationId: "rec_investigate_communication_failures",
        category: "communications",
        title: "Investigate communication failures",
        recommendation: "Review provider execution",
        priority: 80,
        evidence: ["communication_failed_count=5"],
      }),
    ],
    metrics: [],
    metadata: { deterministic: true },
  });
}

test("AnalyticsViewAdapter: generates immutable AnalyticsViewModel + summary mapping", () => {
  const runtime = new AnalyticsRuntime({ nowISO: NOW0 });
  const report = makeFrozenReport();
  const adapter = new AnalyticsViewAdapter({ nowISO: NOW0 });

  const vm = adapter.translate({ analyticsRuntime: runtime, analyticsIntelligenceReport: report });

  assert.ok(Object.isFrozen(vm));
  assert.equal(vm.viewId, "VIEW_ID_ANALYTICS_EXECUTIVE");
  assert.equal(vm.companyId, "company_1");
  assert.equal(vm.generatedAt, NOW0);
  assert.equal(vm.summary, "Executive analytics summary");
  assert.equal(vm.overallPerformance, 72);
});

test("AnalyticsViewAdapter: KPI mapping uses deterministic status/badge/priority", () => {
  const runtime = new AnalyticsRuntime({ nowISO: NOW0 });
  const report = makeFrozenReport();
  const adapter = new AnalyticsViewAdapter({ nowISO: NOW0 });

  const vm = adapter.translate({ analyticsRuntime: runtime, analyticsIntelligenceReport: report });
  assert.equal(vm.kpis.length, 2);

  const k0 = vm.kpis.find((k) => String(k.kpiId) === "request_volume");
  assert.ok(k0);
  assert.equal(k0.status, "missing");
  assert.equal(k0.badge, "Missing");
  assert.equal(k0.priority, 90);

  const k1 = vm.kpis.find((k) => String(k.kpiId) === "communication_failure_count");
  assert.ok(k1);
  assert.equal(k1.status, "recorded");
  assert.equal(k1.badge, "Recorded");
  assert.equal(k1.priority, 70);
});

test("AnalyticsViewAdapter: trend/icon/severity mapping is deterministic", () => {
  const runtime = new AnalyticsRuntime({ nowISO: NOW0 });
  const report = makeFrozenReport();
  const adapter = new AnalyticsViewAdapter({ nowISO: NOW0 });

  const vm = adapter.translate({ analyticsRuntime: runtime, analyticsIntelligenceReport: report });
  assert.equal(vm.trends.length, 1);
  const t = vm.trends[0];
  assert.equal(t.direction, "declining");
  assert.equal(t.icon, "icon_down");
  assert.equal(t.severity, 90);
});

test("AnalyticsViewAdapter: insight importance mapping and recommendation actionType mapping", () => {
  const runtime = new AnalyticsRuntime({ nowISO: NOW0 });
  const report = makeFrozenReport();
  const adapter = new AnalyticsViewAdapter({ nowISO: NOW0 });

  const vm = adapter.translate({ analyticsRuntime: runtime, analyticsIntelligenceReport: report });

  assert.equal(vm.insights.length, 1);
  assert.equal(vm.insights[0].importance, "high");

  assert.equal(vm.recommendations.length, 1);
  assert.equal(vm.recommendations[0].actionType, "rec_investigate_communication_failures");
  assert.equal(vm.recommendations[0].priority, 80);
});

test("AnalyticsViewAdapter: does not mutate AnalyticsRuntime (read-only) and preserves immutability", () => {
  const runtime = new AnalyticsRuntime({ nowISO: NOW0 });
  const before = JSON.stringify({
    metrics: runtime.getMetrics(),
    dataPoints: runtime.getDataPoints(),
    derivedMetrics: runtime.getDerivedMetrics(),
  });

  const report = makeFrozenReport();
  const adapter = new AnalyticsViewAdapter({ nowISO: NOW0 });
  const vm = adapter.translate({ analyticsRuntime: runtime, analyticsIntelligenceReport: report });

  assert.ok(Object.isFrozen(vm));
  assert.ok(Object.isFrozen(vm.kpis[0]));
  assert.ok(Object.isFrozen(vm.trends[0]));
  assert.ok(Object.isFrozen(vm.insights[0]));
  assert.ok(Object.isFrozen(vm.recommendations[0]));

  const after = JSON.stringify({
    metrics: runtime.getMetrics(),
    dataPoints: runtime.getDataPoints(),
    derivedMetrics: runtime.getDerivedMetrics(),
  });
  assert.equal(after, before, "AnalyticsRuntime must not be mutated by adapter.");
});

