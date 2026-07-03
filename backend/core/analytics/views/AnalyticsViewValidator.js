import {
  KPI_BADGE_ALLOWED,
  KPI_STATUS_ALLOWED,
  INSIGHT_IMPORTANCE_ALLOWED,
  TREND_ICON_ALLOWED,
} from "./AnalyticsViewDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsViewValidator: ${message}`);
}

function isFrozenObject(v) {
  return v !== null && typeof v === "object" ? Object.isFrozen(v) : false;
}

export function validateAnalyticsViewModel(vm) {
  if (!vm || typeof vm !== "object") fail("view model required.");

  const requiredTop = ["viewId", "companyId", "generatedAt", "summary", "overallPerformance", "kpis", "trends", "insights", "recommendations", "metrics", "metadata"];
  for (const k of requiredTop) {
    if (!(k in vm)) fail(`missing field: ${k}`);
  }

  if (typeof vm.viewId !== "string") fail("viewId required string.");
  if (typeof vm.companyId !== "string") fail("companyId required string.");
  if (typeof vm.generatedAt !== "string") fail("generatedAt required string.");
  if (typeof vm.summary !== "string") fail("summary required string.");
  if (typeof vm.overallPerformance !== "number" || !Number.isFinite(vm.overallPerformance)) fail("overallPerformance must be finite number.");

  if (!Array.isArray(vm.kpis)) fail("kpis must be array.");
  if (!Array.isArray(vm.trends)) fail("trends must be array.");
  if (!Array.isArray(vm.insights)) fail("insights must be array.");
  if (!Array.isArray(vm.recommendations)) fail("recommendations must be array.");
  if (!vm.metrics || typeof vm.metrics !== "object") fail("metrics must be object.");
  if (!vm.metadata || typeof vm.metadata !== "object") fail("metadata must be object.");

  for (const kpi of vm.kpis) {
    if (!isFrozenObject(kpi)) fail("kpi entries must be frozen objects.");
    if (!kpi.kpiId || typeof kpi.kpiId !== "string") fail("kpi.kpiId required string.");
    if (typeof kpi.value !== "number" || !Number.isFinite(kpi.value)) fail("kpi.value must be finite number.");
    if (!KPI_STATUS_ALLOWED.includes(String(kpi.status))) fail(`kpi.status invalid: ${String(kpi.status)}`);
    if (!KPI_BADGE_ALLOWED.includes(String(kpi.badge))) fail(`kpi.badge invalid: ${String(kpi.badge)}`);
  }

  for (const t of vm.trends) {
    if (!isFrozenObject(t)) fail("trend entries must be frozen objects.");
    if (!t.trendId || typeof t.trendId !== "string") fail("trend.trendId required string.");
    if (!TREND_ICON_ALLOWED.includes(String(t.icon))) fail(`trend.icon invalid: ${String(t.icon)}`);
    if (!String(t.direction)) fail("trend.direction required.");
  }

  for (const ins of vm.insights) {
    if (!isFrozenObject(ins)) fail("insight entries must be frozen objects.");
    if (!ins.insightId || typeof ins.insightId !== "string") fail("insight.insightId required string.");
    if (!INSIGHT_IMPORTANCE_ALLOWED.includes(String(ins.importance))) fail(`insight.importance invalid: ${String(ins.importance)}`);
  }

  for (const r of vm.recommendations) {
    if (!isFrozenObject(r)) fail("recommendation entries must be frozen objects.");
    if (!r.recommendationId || typeof r.recommendationId !== "string") fail("recommendation.recommendationId required string.");
    if (typeof r.priority !== "number" || !Number.isFinite(r.priority)) fail("recommendation.priority must be finite number.");
  }

  if (!Object.isFrozen(vm)) fail("view model must be frozen.");
  if (!Object.isFrozen(vm.metadata)) fail("view model.metadata must be frozen.");

  return { ok: true };
}

