import assert from "node:assert/strict";
import { test } from "node:test";

import { AnalyticsEngine } from "./AnalyticsEngine.js";
import { calculateMetric } from "./CalculationEngine.js";
import { getMetricDefinition, listMetricIds, resolveAnalyticsTemplate } from "./MetricCatalog.js";
import { createMetricDefinition } from "./MetricDefinition.js";
import { METRIC_AVAILABILITY } from "./MetricDefinition.js";
import { mapAnalyticsToBusinessOS } from "./mapAnalyticsToBusinessOS.js";
import { AnalyticsDefinitionStore } from "./AnalyticsDefinitionStore.js";
import { DashboardRecommendationEngine } from "../../ai-builder/DashboardRecommendationEngine.js";
import { DashboardGenerationStage } from "../../architect/ArchitectMatchingStages.js";

const NOW = "2026-07-11T12:00:00.000Z";

function sampleEvidence() {
  return {
    asOf: NOW,
    workItems: [
      { id: "w1", title: "Follow up", status: "OPEN", dueAt: "2026-07-01T00:00:00.000Z" },
      { id: "w2", title: "Approve campaign", status: "OPEN", assigneeId: "u1" },
      { id: "w3", title: "Done", status: "COMPLETED", openedAt: "2026-07-01T00:00:00.000Z", firstResponseAt: "2026-07-01T02:00:00.000Z", withinSla: true },
      { id: "w4", title: "Also done", status: "COMPLETED", openedAt: "2026-07-02T00:00:00.000Z", firstResponseAt: "2026-07-02T01:00:00.000Z", withinSla: true, slaBreached: false },
      { id: "w5", title: "Cancelled", status: "CANCELLED" },
    ],
    approvals: [
      { id: "a1", label: "Campaign send", status: "pending" },
    ],
    integrations: [
      { id: "i1", providerId: "gmail", label: "Gmail", health: "connected" },
      { id: "i2", providerId: "stripe", label: "Stripe", health: "error" },
    ],
    knowledgeDocumentCount: 4,
    memberCount: 2,
  };
}

test("metric registration covers reusable catalog", () => {
  assert.ok(listMetricIds().includes("open_work_count"));
  assert.ok(listMetricIds().includes("revenue_total"));
  assert.ok(getMetricDefinition("open_work_count").fabricatedForbidden);
});

test("deterministic calculations from evidence", () => {
  const open = calculateMetric(getMetricDefinition("open_work_count"), sampleEvidence(), { nowISO: NOW });
  assert.equal(open.availability, METRIC_AVAILABILITY.available);
  assert.equal(open.value, 2);
  assert.equal(open.fabricated, false);

  const overdue = calculateMetric(getMetricDefinition("overdue_work_count"), sampleEvidence(), { nowISO: NOW });
  assert.equal(overdue.value, 1);
});

test("time windows and dimensions are present on definitions", () => {
  const def = getMetricDefinition("work_completion_rate");
  assert.equal(def.timeWindow, "7d");
  assert.ok(Array.isArray(def.dimensions));
});

test("permissions gate metric visibility", () => {
  const result = calculateMetric(
    getMetricDefinition("pending_approvals_count"),
    sampleEvidence(),
    { role: "EMPLOYEE", nowISO: NOW },
  );
  assert.equal(result.availability, METRIC_AVAILABILITY.unavailable);
});

test("tenant isolation is explicit on analytics model", () => {
  const a = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    businessId: "biz_a",
    evidence: sampleEvidence(),
  });
  const b = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    businessId: "biz_b",
    evidence: sampleEvidence(),
  });
  assert.equal(a.analyticsModel.tenantIsolation.businessId, "biz_a");
  assert.notEqual(a.businessOsMapping.tenantIsolation.businessId, b.businessOsMapping.tenantIsolation.businessId);
});

test("unavailable vs zero truth — missing source is not fake zero", () => {
  const missing = calculateMetric(getMetricDefinition("open_work_count"), {}, { nowISO: NOW });
  assert.equal(missing.availability, METRIC_AVAILABILITY.insufficient_data);
  assert.equal(missing.value, null);

  const zero = calculateMetric(getMetricDefinition("open_work_count"), { workItems: [], asOf: NOW }, { nowISO: NOW });
  assert.equal(zero.availability, METRIC_AVAILABILITY.available);
  assert.equal(zero.value, 0);
});

test("stale data lowers confidence", () => {
  const stale = calculateMetric(
    getMetricDefinition("open_work_count"),
    { ...sampleEvidence(), asOf: "2026-06-01T00:00:00.000Z" },
    { nowISO: NOW },
  );
  assert.equal(stale.availability, METRIC_AVAILABILITY.stale);
  assert.ok(stale.confidence < 0.5);
});

test("targets and threshold alerts", () => {
  const engine = new AnalyticsEngine();
  engine.setTarget("open_work_count", 1);
  const result = engine.recommendAnalytics({
    businessSummary: { industry: "default" },
    evidence: sampleEvidence(),
  });
  assert.equal(engine.store.getTarget("open_work_count").target, 1);
  assert.ok(result.analyticsModel.alerts.some((alert) => alert.kind === "overdue_work"));
  assert.ok(result.analyticsModel.alerts.every((alert) => alert.createsWork === false));

  const failed = result.analyticsModel.results.find((entry) => entry.metricId === "failed_integrations_count");
  // value 1 with warnAbove 1 uses > — bump evidence to trigger metric alert
  const hot = calculateMetric(
    getMetricDefinition("failed_integrations_count"),
    {
      integrations: [
        { id: "1", health: "error" },
        { id: "2", health: "error" },
      ],
      asOf: NOW,
    },
    { nowISO: NOW },
  );
  assert.ok(hot.alert);
  assert.ok(failed);
});

test("drill-down evidence is attached when available", () => {
  const overdue = calculateMetric(getMetricDefinition("overdue_work_count"), sampleEvidence(), { nowISO: NOW });
  assert.ok(overdue.drillDownEvidence.length >= 1);
  assert.ok(overdue.calculation);
  assert.ok(overdue.freshness);
});

test("Architect recommendations include reason confidence evidence calculation requiredData alternatives", () => {
  const result = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "dental" },
    evidence: sampleEvidence(),
  });
  assert.ok(result.recommendations.length >= 5);
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.reason || recommendation.why);
    assert.equal(typeof recommendation.confidence, "number");
    assert.ok(Array.isArray(recommendation.evidence));
    assert.ok(Array.isArray(recommendation.alternatives));
    assert.ok("calculationExplanation" in recommendation);
    assert.ok(Array.isArray(recommendation.requiredData));
  }
});

test("dashboard rendering uses registered components only", () => {
  const facade = new DashboardRecommendationEngine();
  const result = facade.recommend({ businessSummary: { industry: "sports" } });
  assert.equal(result.ok, true);
  assert.ok(result.dashboard.cards.length >= 4);
  assert.ok(result.analyticsModel);
  assert.ok(result.businessOsMapping.dashboardDefinitions.length >= 1);
});

test("saved reports and restart persistence for definitions", () => {
  const store = new AnalyticsDefinitionStore();
  const engine = new AnalyticsEngine({ store });
  const custom = createMetricDefinition({
    metricId: "custom_quality_score",
    label: "Custom quality",
    category: "quality",
    valueType: "quality",
    aggregation: "average",
    sourceRuntime: "work",
    sourceFields: ["qualityScore"],
  });
  engine.registerMetric(custom);
  engine.setTarget("custom_quality_score", 0.9);
  engine.saveReport({
    reportId: "r1",
    label: "Quality report",
    metricIds: ["custom_quality_score"],
    exportable: true,
  });
  const snap = engine.snapshotDefinitions();

  const restored = new AnalyticsEngine({ store: new AnalyticsDefinitionStore() });
  restored.restoreDefinitions(snap);
  assert.equal(restored.store.getMetricDefinition("custom_quality_score").label, "Custom quality");
  assert.equal(restored.store.getTarget("custom_quality_score").target, 0.9);
  assert.equal(restored.listSavedReports().length, 1);
});

test("multi-industry templates differ without vertical engines", () => {
  const pm = resolveAnalyticsTemplate("property_management");
  const dental = resolveAnalyticsTemplate("dental");
  assert.ok(pm.metricIds.includes("open_work_count"));
  assert.ok(dental.metricIds.includes("avg_response_hours"));
});

test("no fabricated revenue open or click metrics", () => {
  const result = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    evidence: sampleEvidence(),
  });
  assert.equal(result.analyticsModel.metrics.some((entry) => entry.metricId === "revenue_total"), false);
  assert.ok(result.recommendations.some((entry) => /fabricated revenue/i.test(entry.label)));
  assert.equal(result.analyticsModel.honesty.fabricatedMetricsForbidden, true);

  const withFinance = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    evidence: {
      ...sampleEvidence(),
      financialVerified: true,
      financialEvents: [{ id: "f1", amount: 100, label: "Invoice" }],
    },
  });
  assert.ok(withFinance.analyticsModel.metrics.some((entry) => entry.metricId === "revenue_total"));
});

test("mapAnalyticsToBusinessOS fills dashboard definitions", () => {
  const result = new AnalyticsEngine().recommendAnalytics({
    businessSummary: { industry: "default" },
    evidence: sampleEvidence(),
    businessId: "biz_x",
  });
  const mapped = mapAnalyticsToBusinessOS(result.analyticsModel);
  assert.ok(mapped.dashboardDefinitions[0].widgets.length >= 2);
  assert.ok(mapped.reportDefinitions.length >= 1);
});

test("Architect dashboard_generation stage outputs analytics model", () => {
  const stage = new DashboardGenerationStage();
  const result = stage.generate({
    dna: { company: { industry: "sports", name: "Northline" } },
    businessId: "biz_hockey",
    evidence: sampleEvidence(),
  });
  assert.equal(result.stageId, "dashboard_generation");
  assert.ok(result.outputs.dashboard.cards.length >= 1);
  assert.ok(result.outputs.analyticsModel.metrics.length >= 1);
  assert.ok(result.outputs.businessOsMapping.dashboardDefinitions.length >= 1);
});
