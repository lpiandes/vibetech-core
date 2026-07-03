import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ANALYTICS_VIEW_ID, KPI_BADGE_ALLOWED, KPI_STATUS_ALLOWED, TREND_ICON_ALLOWED, INSIGHT_IMPORTANCE_ALLOWED } from "./AnalyticsViewDefaults.js";

import { createAnalyticsViewModel } from "./AnalyticsViewModel.js";

import { createAnalyticsSummaryView } from "./AnalyticsSummaryView.js";
import { createAnalyticsKPIView } from "./AnalyticsKPIView.js";
import { createAnalyticsTrendView } from "./AnalyticsTrendView.js";
import { createAnalyticsInsightView } from "./AnalyticsInsightView.js";
import { createAnalyticsRecommendationView } from "./AnalyticsRecommendationView.js";

import { validateAnalyticsViewModel } from "./AnalyticsViewValidator.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeString(v, fallback = "") {
  return v === null || v === undefined ? fallback : String(v);
}

function computeKpiStatus({ value }) {
  const v = Number(value ?? 0);
  return v <= 0 ? "missing" : "recorded";
}

function computeKpiBadge(status) {
  const st = String(status);
  if (!KPI_STATUS_ALLOWED.includes(st)) return "Missing";
  return st === "missing" ? "Missing" : "Recorded";
}

function computeKpiPriority({ category, status }) {
  if (status === "missing") return 90;
  const cat = String(category ?? "");
  if (cat === "communications" || cat === "requests") return 70;
  if (cat === "work") return 55;
  if (cat === "team") return 45;
  if (cat === "capabilities") return 45;
  return 50;
}

function trendIcon(direction) {
  const d = String(direction ?? "");
  if (d === "improving") return "icon_up";
  if (d === "stable") return "icon_flat";
  if (d === "declining") return "icon_down";
  return "icon_unknown";
}

function trendSeverity(direction) {
  const d = String(direction ?? "");
  if (d === "declining") return 90;
  if (d === "improving") return 65;
  if (d === "stable") return 25;
  return 0;
}

function insightImportance(category) {
  const c = String(category ?? "");
  if (c === "communications") return "high";
  if (c === "requests" || c === "work") return "medium";
  return "low";
}

export class AnalyticsViewAdapter {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  translate({
    analyticsRuntime,
    analyticsIntelligenceReport,
    missionControl,
    companyHealth,
    nowISO,
  } = {}) {
    if (!analyticsRuntime) throw new Error("AnalyticsViewAdapter.translate requires analyticsRuntime.");
    if (!analyticsIntelligenceReport) throw new Error("AnalyticsViewAdapter.translate requires analyticsIntelligenceReport.");

    const report = analyticsIntelligenceReport;
    const effectiveGeneratedAt = safeString(report.generatedAt, nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z");
    const companyId = report.companyId === null ? "company" : safeString(report.companyId, "company");

    // Summary mapping only.
    const summaryView = createAnalyticsSummaryView({
      viewId: ANALYTICS_VIEW_ID,
      companyId,
      generatedAt: effectiveGeneratedAt,
      summary: safeString(report.summary),
      overallPerformance: Number(report.overallPerformance ?? 0),
      metadata: deepFreeze({ derivedFrom: { reportId: safeString(report.reportId) } }),
    });

    const kpiViews = safeArray(report.kpis).map((kpi) => {
      const status = computeKpiStatus({ value: kpi.value });
      const badge = computeKpiBadge(status);
      const priority = computeKpiPriority({ category: kpi.category, status });
      return createAnalyticsKPIView({
        kpiId: kpi.kpiId,
        name: kpi.name,
        category: kpi.category,
        value: Number(kpi.value ?? 0),
        unit: kpi.unit,
        meaning: kpi.meaning,
        status,
        badge,
        priority,
        metadata: deepFreeze({ derivedFrom: { reportId: safeString(report.reportId), kpiId: safeString(kpi.kpiId) } }),
      });
    });

    const trendViews = safeArray(report.trends).map((t) => {
      const icon = trendIcon(t.direction);
      const severity = trendSeverity(t.direction);
      return createAnalyticsTrendView({
        trendId: t.trendId,
        kpiId: t.kpiId,
        direction: t.direction,
        icon,
        severity,
        previousValue: t.previousValue,
        currentValue: t.currentValue,
        note: t.note,
        metadata: deepFreeze({ derivedFrom: { reportId: safeString(report.reportId), trendId: safeString(t.trendId) } }),
      });
    });

    const insightViews = safeArray(report.insights).map((ins) =>
      createAnalyticsInsightView({
        insightId: ins.insightId,
        category: ins.category,
        title: ins.title,
        message: ins.message,
        importance: insightImportance(ins.category),
        evidence: safeArray(ins.evidence),
        metadata: deepFreeze({ derivedFrom: { reportId: safeString(report.reportId), insightId: safeString(ins.insightId) } }),
      }),
    );

    const recommendationViews = safeArray(report.recommendations).map((rec) =>
      createAnalyticsRecommendationView({
        recommendationId: rec.recommendationId,
        actionType: safeString(rec.recommendationId, safeString(rec.title)),
        category: rec.category,
        priority: Number(rec.priority ?? 0),
        title: rec.title,
        recommendation: rec.recommendation,
        evidence: safeArray(rec.evidence),
        metadata: deepFreeze({ derivedFrom: { reportId: safeString(report.reportId), recommendationId: safeString(rec.recommendationId) } }),
      }),
    );

    const vm = createAnalyticsViewModel({
      viewId: ANALYTICS_VIEW_ID,
      companyId,
      generatedAt: effectiveGeneratedAt,
      summary: summaryView.summary,
      overallPerformance: Number(summaryView.overallPerformance ?? 0),
      kpis: kpiViews,
      trends: trendViews,
      insights: insightViews,
      recommendations: recommendationViews,
      metrics: report.metrics ?? [],
      metadata: deepFreeze({
        derivedFrom: { reportId: safeString(report.reportId) },
        missionControlProvided: Boolean(missionControl),
        companyHealthProvided: Boolean(companyHealth),
      }),
    });

    validateAnalyticsViewModel(vm);
    return vm;
  }
}

