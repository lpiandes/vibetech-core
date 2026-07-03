import crypto from "node:crypto";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { ANALYTICS_INTELLIGENCE_KPI_DEFINITIONS, clamp, OVERALL_PERFORMANCE_COMPONENT_WEIGHTS } from "./AnalyticsIntelligenceDefaults.js";

import { createAnalyticsIntelligenceReport } from "./AnalyticsIntelligenceReport.js";
import { createAnalyticsKPI } from "./AnalyticsKPI.js";
import { createAnalyticsTrend } from "./AnalyticsTrend.js";
import { createAnalyticsInsight } from "./AnalyticsInsight.js";
import { createAnalyticsRecommendation } from "./AnalyticsRecommendation.js";

function fail(message) {
  throw new Error(`AnalyticsIntelligenceBuilder: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function sha256(str) {
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

function deterministicNowISO(nowISO, fallback) {
  const v = nowISO ?? fallback;
  const s = String(v);
  const t = new Date(s).toISOString();
  return t;
}

function getDerivedMetricValue(analyticsRuntime, metricId) {
  const sid = String(metricId);
  const derived = analyticsRuntime?.getDerivedMetrics?.()?.derivedMetrics ?? {};
  const found = derived[String(sid)] ?? null;
  if (!found) return 0;
  return Number(found.value ?? 0);
}

function getDataPointsByMetric(analyticsRuntime, metricId) {
  return safeArray(analyticsRuntime?.getDataPointsByMetric?.(metricId));
}

function sumValues(dataPoints) {
  return dataPoints.reduce((a, d) => a + Number(d.value ?? 0), 0);
}

function determineTrendDirectionFromDataPoints(dataPoints) {
  const pts = [...safeArray(dataPoints)].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (pts.length < 2) return { direction: "unknown", previousValue: null, currentValue: null };

  const mid = Math.floor(pts.length / 2);
  const prev = pts.slice(0, mid);
  const last = pts.slice(mid);
  if (!prev.length || !last.length) return { direction: "unknown", previousValue: null, currentValue: null };

  const prevSum = sumValues(prev);
  const lastSum = sumValues(last);
  if (lastSum > prevSum) return { direction: "improving", previousValue: prevSum, currentValue: lastSum };
  if (lastSum < prevSum) return { direction: "declining", previousValue: prevSum, currentValue: lastSum };
  return { direction: "stable", previousValue: prevSum, currentValue: lastSum };
}

function determineNetTrendFromCreatedVsArchived({ analyticsRuntime, createdMetricId, archivedMetricId }) {
  const createdPoints = [...getDataPointsByMetric(analyticsRuntime, createdMetricId)].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (createdPoints.length < 2) return { direction: "unknown", previousValue: null, currentValue: null };

  const mid = Math.floor(createdPoints.length / 2);
  const prevCreated = createdPoints.slice(0, mid);
  const lastCreated = createdPoints.slice(mid);
  if (!prevCreated.length || !lastCreated.length) return { direction: "unknown", previousValue: null, currentValue: null };

  const prevStart = String(prevCreated[0].timestamp);
  const prevEnd = String(prevCreated[prevCreated.length - 1].timestamp);
  const lastStart = String(lastCreated[0].timestamp);
  const lastEnd = String(lastCreated[lastCreated.length - 1].timestamp);

  const archivedPoints = [...getDataPointsByMetric(analyticsRuntime, archivedMetricId)];

  const prevArchived = archivedPoints.filter((d) => {
    const ts = String(d.timestamp);
    return ts >= prevStart && ts <= prevEnd;
  });
  const lastArchived = archivedPoints.filter((d) => {
    const ts = String(d.timestamp);
    return ts >= lastStart && ts <= lastEnd;
  });

  const prevNet = sumValues(prevCreated) - sumValues(prevArchived);
  const lastNet = sumValues(lastCreated) - sumValues(lastArchived);

  if (lastNet > prevNet) return { direction: "improving", previousValue: prevNet, currentValue: lastNet };
  if (lastNet < prevNet) return { direction: "declining", previousValue: prevNet, currentValue: lastNet };
  return { direction: "stable", previousValue: prevNet, currentValue: lastNet };
}

function buildMetricsList({ analyticsRuntime, usedMetricIds }) {
  const metrics = [];
  const unique = Array.from(new Set(safeArray(usedMetricIds).map((x) => String(x))));
  for (const metricId of unique) {
    const val = getDerivedMetricValue(analyticsRuntime, metricId);
    const m = analyticsRuntime.getMetric?.(metricId);
    metrics.push(
      deepFreeze({
        metricId: String(metricId),
        category: m?.category ?? null,
        value: Number(val),
      }),
    );
  }
  return deepFreeze(metrics);
}

function computeOverallPerformance({ kpis, metricValues }) {
  const received = metricValues.request_received_count ?? 0;
  const converted = metricValues.request_converted_count ?? 0;
  const created = metricValues.work_created_count ?? 0;
  const completed = metricValues.work_completed_count ?? 0;
  const sent = metricValues.communication_sent_count ?? 0;
  const failed = metricValues.communication_failed_count ?? 0;

  const conversionRate = received > 0 ? converted / received : null;
  const completionRate = created > 0 ? completed / created : null;
  const communicationSuccessRate = sent + failed > 0 ? sent / (sent + failed) : null;

  const teamNet = (metricValues.team_member_created_count ?? 0) - (metricValues.team_member_archived_count ?? 0);
  const teamTotal = (metricValues.team_member_created_count ?? 0) + (metricValues.team_member_archived_count ?? 0);
  const teamRate = teamTotal > 0 ? teamNet / teamTotal : null; // [-1..1]

  const capabilityNet = (metricValues.capability_registered_count ?? 0) - (metricValues.capability_archived_count ?? 0);
  const capabilityTotal = (metricValues.capability_registered_count ?? 0) + (metricValues.capability_archived_count ?? 0);
  const capabilityRate = capabilityTotal > 0 ? capabilityNet / capabilityTotal : null; // [-1..1]

  // Map rate from [-1..1] to [0..1]. Unknown => 0.5 neutral.
  const mapGrowthRate = (r) => {
    if (r === null) return 0.5;
    return clamp((r + 1) / 2, 0, 1);
  };

  const growthNetScore = (mapGrowthRate(teamRate) + mapGrowthRate(capabilityRate)) / 2;

  const conversionScore = conversionRate === null ? 50 : clamp(conversionRate, 0, 1) * 100;
  const completionScore = completionRate === null ? 50 : clamp(completionRate, 0, 1) * 100;
  const communicationScore = communicationSuccessRate === null ? 50 : clamp(communicationSuccessRate, 0, 1) * 100;
  const growthScore = clamp(growthNetScore, 0, 1) * 100;

  const components = {
    conversionRate: conversionScore,
    completionRate: completionScore,
    communicationSuccessRate: communicationScore,
    growthNet: growthScore,
  };

  let weighted = 0;
  let weightSum = 0;
  for (const c of OVERALL_PERFORMANCE_COMPONENT_WEIGHTS) {
    const w = Number(c.weight);
    weighted += Number(components[c.key] ?? 0) * w;
    weightSum += w;
  }

  const overall = weightSum > 0 ? weighted / weightSum : 0;
  return Math.round(clamp(overall, 0, 100));
}

function buildMeaningForKPI({ kpiDef, metricValues }) {
  const id = String(kpiDef.kpiId);
  const val = Number(metricValues[id] ?? metricValues[kpiDef.metricId] ?? 0);

  if (id === "request_volume") {
    if (val <= 0) return "No request demand recorded yet.";
    return "Incoming demand is being recorded.";
  }
  if (id === "request_conversion_count") {
    const received = Number(metricValues.request_received_count ?? 0);
    const converted = Number(metricValues.request_converted_count ?? 0);
    const rate = received > 0 ? converted / received : null;
    if (received <= 0) return "Conversion recorded, but request volume is unknown.";
    if (rate !== null && rate >= 0.6) return "Conversion performance is strong.";
    if (rate !== null && rate >= 0.3) return "Conversion performance is moderate.";
    return "Conversion performance is weak.";
  }
  if (id === "work_created_count") {
    if (val <= 0) return "No work has been created yet.";
    return "Work creation is active.";
  }
  if (id === "work_completed_count") {
    const created = Number(metricValues.work_created_count ?? 0);
    if (created <= 0) return "Work completion recorded, but created work is unknown.";
    const rate = created > 0 ? Number(metricValues.work_completed_count ?? 0) / created : null;
    if (rate !== null && rate >= 0.8) return "Completion rate is healthy.";
    if (rate !== null && rate >= 0.5) return "Completion rate is moderate.";
    return "Completion rate is low.";
  }
  if (id === "communication_success_count") {
    const sent = Number(metricValues.communication_sent_count ?? 0);
    const failed = Number(metricValues.communication_failed_count ?? 0);
    const rate = sent + failed > 0 ? sent / (sent + failed) : null;
    if (rate === null) return "Communication outcomes are not yet recorded.";
    if (rate >= 0.8) return "Communication success rate is high.";
    if (rate >= 0.5) return "Communication success rate is mixed.";
    return "Communication success rate is low.";
  }
  if (id === "communication_failure_count") {
    const failed = Number(metricValues.communication_failed_count ?? 0);
    if (failed <= 0) return "No communication failures recorded.";
    return "Failures have been recorded; investigate sources.";
  }
  if (id === "team_growth_net") {
    if (val > 0) return "Team is expanding net of archived members.";
    if (val < 0) return "Team is contracting net of archived members.";
    return "Team size is stable net of archived members.";
  }
  if (id === "capability_growth_net") {
    if (val > 0) return "Capability coverage is expanding net of archived capabilities.";
    if (val < 0) return "Capability coverage is shrinking net of archived capabilities.";
    return "Capability coverage is stable net of archived capabilities.";
  }

  return "Deterministic KPI derived from recorded datapoints.";
}

function buildInsightsAndRecommendations({ metricValues, trends }) {
  const insights = [];
  const recommendations = [];
  const evidence = [];

  const received = Number(metricValues.request_received_count ?? 0);
  const converted = Number(metricValues.request_converted_count ?? 0);
  const created = Number(metricValues.work_created_count ?? 0);
  const completed = Number(metricValues.work_completed_count ?? 0);
  const sent = Number(metricValues.communication_sent_count ?? 0);
  const failed = Number(metricValues.communication_failed_count ?? 0);
  const teamNet = Number(metricValues.team_member_created_count ?? 0) - Number(metricValues.team_member_archived_count ?? 0);
  const capabilityNet = Number(metricValues.capability_registered_count ?? 0) - Number(metricValues.capability_archived_count ?? 0);

  const conversionRate = received > 0 ? converted / received : null;
  const completionRate = created > 0 ? completed / created : null;
  const communicationSuccessRate = sent + failed > 0 ? sent / (sent + failed) : null;

  const addInsight = (insightId, category, title, message, evidenceItems) => {
    insights.push(
      createAnalyticsInsight({
        insightId,
        category,
        title,
        message,
        evidence: evidenceItems,
      }),
    );
  };

  const addRecommendation = (recommendationId, category, title, recommendation, priority, evidenceItems) => {
    recommendations.push(
      createAnalyticsRecommendation({
        recommendationId,
        category,
        title,
        recommendation,
        priority,
        evidence: evidenceItems,
      }),
    );
  };

  if (failed > 0 && (communicationSuccessRate === null || communicationSuccessRate < 0.7)) {
    addInsight(
      "insight_communication_failures",
      "communications",
      "High communication failures",
      "Failures are dominating recorded communication outcomes; provider execution or channel routing needs attention.",
      [`communication_failed_count=${failed}`, `communication_success_rate=${communicationSuccessRate}`],
    );
    addRecommendation(
      "rec_investigate_communication_failures",
      "communications",
      "Investigate communication failures",
      "Review communication failures by channel/provider and ensure deterministic execution rules are applied by the provider layer.",
      80,
      [`communication_failed_count=${failed}`],
    );
  }

  if (conversionRate !== null && conversionRate < 0.5 && received > 0) {
    addInsight(
      "insight_conversion_lag",
      "requests",
      "Request conversion lag",
      "A significant portion of recorded requests are not being converted to work.",
      [`request_received_count=${received}`, `request_converted_count=${converted}`, `conversion_rate=${conversionRate}`],
    );
    addRecommendation(
      "rec_review_conversion_process",
      "requests",
      "Review request conversion process",
      "Verify qualification rules and conversion assignments ensure eligible requests are deterministically converted into work items.",
      70,
      [`conversion_rate=${conversionRate}`],
    );
  }

  if (completionRate !== null && completionRate < 0.6 && created > 0) {
    addInsight(
      "insight_completion_backlog",
      "work",
      "Work completion backlog",
      "Recorded work completion is low relative to created work; backlog reduction is needed.",
      [`work_created_count=${created}`, `work_completed_count=${completed}`, `completion_rate=${completionRate}`],
    );
    addRecommendation(
      "rec_reduce_work_backlog",
      "work",
      "Reduce work backlog",
      "Audit work stage/queue configurations and ensure deterministic assignment and completion conditions are being met.",
      75,
      [`completion_rate=${completionRate}`],
    );
  }

  if (teamNet < 0) {
    addInsight(
      "insight_team_contraction",
      "team",
      "Team contraction",
      "Net team growth is negative based on created vs archived member datapoints.",
      [`team_net=${teamNet}`],
    );
    addRecommendation(
      "rec_expand_team_capacity",
      "team",
      "Expand team capacity",
      "Add or reactivate deterministic capacity by assigning additional available members to core work queues.",
      60,
      [`team_net=${teamNet}`],
    );
  }

  if (capabilityNet < 0) {
    addInsight(
      "insight_capability_coverage_decline",
      "capabilities",
      "Capability coverage decline",
      "Net capability growth is negative based on registered vs archived capability datapoints.",
      [`capability_net=${capabilityNet}`],
    );
    addRecommendation(
      "rec_increase_capability_coverage",
      "capabilities",
      "Increase capability coverage",
      "Register missing capabilities required by workflows and ensure deterministic activation rules keep the capability catalog healthy.",
      65,
      [`capability_net=${capabilityNet}`],
    );
  }

  // If no insights were triggered, provide a neutral insight.
  if (insights.length === 0) {
    addInsight(
      "insight_no_major_issues",
      "operations",
      "No major measurable issues detected",
      "Recorded metrics do not cross deterministic thresholds for major problems; keep monitoring datapoints.",
      [`received=${received}`, `converted=${converted}`, `created=${created}`, `completed=${completed}`, `sent=${sent}`, `failed=${failed}`],
    );
  }

  // De-duplicate recommendations by recommendationId.
  const seen = new Set();
  const uniqueRecs = [];
  for (const r of recommendations) {
    const id = String(r.recommendationId);
    if (seen.has(id)) continue;
    seen.add(id);
    uniqueRecs.push(r);
  }

  return { insights, recommendations: uniqueRecs };
}

export function buildAnalyticsIntelligenceReport({
  analyticsRuntime,
  companyId = null,
  nowISO,
  companyHealth,
  missionControl,
  workRuntime,
  requestRuntime,
  communicationRuntime,
  capabilityRuntime,
  teamRuntime,
} = {}) {
  if (!analyticsRuntime) fail("analyticsRuntime required.");

  const generatedAt = deterministicNowISO(nowISO, analyticsRuntime.nowISO);

  const metricIdsUsed = new Set();
  const metricValues = {};

  for (const def of ANALYTICS_INTELLIGENCE_KPI_DEFINITIONS) {
    const mid = def.metricId;
    if (mid) metricIdsUsed.add(String(mid));
    if (def.uses?.createdMetricId) metricIdsUsed.add(String(def.uses.createdMetricId));
    if (def.uses?.archivedMetricId) metricIdsUsed.add(String(def.uses.archivedMetricId));
  }

  for (const metricId of Array.from(metricIdsUsed)) {
    metricValues[String(metricId)] = getDerivedMetricValue(analyticsRuntime, metricId);
  }

  const usedMetricIds = Array.from(metricIdsUsed);
  const metricsList = buildMetricsList({ analyticsRuntime, usedMetricIds });

  // KPI values.
  const kpis = [];
  for (const def of ANALYTICS_INTELLIGENCE_KPI_DEFINITIONS) {
    let value = 0;
    if (def.kpiId === "team_growth_net") {
      const createdVal = Number(metricValues.team_member_created_count ?? 0);
      const archivedVal = Number(metricValues.team_member_archived_count ?? 0);
      value = createdVal - archivedVal;
    } else if (def.kpiId === "capability_growth_net") {
      const regVal = Number(metricValues.capability_registered_count ?? 0);
      const archVal = Number(metricValues.capability_archived_count ?? 0);
      value = regVal - archVal;
    } else {
      value = Number(metricValues[String(def.metricId)] ?? 0);
    }

    const meaning = buildMeaningForKPI({ kpiDef: def, metricValues: { ...metricValues, [String(def.kpiId)]: value } });
    kpis.push(
      createAnalyticsKPI({
        kpiId: def.kpiId,
        name: def.name,
        category: def.category,
        value,
        unit: def.unit,
        meaning,
        metricId: def.metricId,
        metadata: { deterministic: true },
      }),
    );
  }

  // Trends.
  const trends = [];
  for (const def of ANALYTICS_INTELLIGENCE_KPI_DEFINITIONS) {
    const trendId = `trend_${def.kpiId}`;
    if (def.kpiId === "team_growth_net") {
      const t = determineNetTrendFromCreatedVsArchived({
        analyticsRuntime,
        createdMetricId: def.uses.createdMetricId,
        archivedMetricId: def.uses.archivedMetricId,
      });
      trends.push(
        createAnalyticsTrend({
          trendId,
          kpiId: def.kpiId,
          metricId: def.metricId,
          direction: t.direction,
          previousValue: t.previousValue,
          currentValue: t.currentValue,
          note: "Net trend computed from recorded created vs archived datapoints.",
        }),
      );
    } else if (def.kpiId === "capability_growth_net") {
      const t = determineNetTrendFromCreatedVsArchived({
        analyticsRuntime,
        createdMetricId: def.uses.createdMetricId,
        archivedMetricId: def.uses.archivedMetricId,
      });
      trends.push(
        createAnalyticsTrend({
          trendId,
          kpiId: def.kpiId,
          metricId: def.metricId,
          direction: t.direction,
          previousValue: t.previousValue,
          currentValue: t.currentValue,
          note: "Net trend computed from recorded registered vs archived datapoints.",
        }),
      );
    } else {
      const pts = getDataPointsByMetric(analyticsRuntime, def.metricId);
      const t = determineTrendDirectionFromDataPoints(pts);
      trends.push(
        createAnalyticsTrend({
          trendId,
          kpiId: def.kpiId,
          metricId: def.metricId,
          direction: t.direction,
          previousValue: t.previousValue,
          currentValue: t.currentValue,
          note: "Trend direction computed from recorded datapoints (no forecasting).",
        }),
      );
    }
  }

  // Overall performance.
  const overallPerformance = computeOverallPerformance({
    kpis,
    metricValues: {
      ...metricValues,
      // also provide computed raw ids needed by scoring.
      request_received_count: metricValues.request_received_count ?? 0,
      request_converted_count: metricValues.request_converted_count ?? 0,
      work_created_count: metricValues.work_created_count ?? 0,
      work_completed_count: metricValues.work_completed_count ?? 0,
      communication_sent_count: metricValues.communication_sent_count ?? 0,
      communication_failed_count: metricValues.communication_failed_count ?? 0,
      team_member_created_count: metricValues.team_member_created_count ?? 0,
      team_member_archived_count: metricValues.team_member_archived_count ?? 0,
      capability_registered_count: metricValues.capability_registered_count ?? 0,
      capability_archived_count: metricValues.capability_archived_count ?? 0,
    },
  });

  const { insights, recommendations } = buildInsightsAndRecommendations({ metricValues, trends });

  // Summary.
  const topInsightTitle = insights[0]?.title ?? "Executive analytics summary";
  const summary = `Overall performance=${overallPerformance}/100. ${topInsightTitle}.`;

  // Report fingerprint (deterministic based on recorded datapoints and derived metric values).
  const fingerprintBase = {
    companyId: companyId === null ? null : String(companyId),
    metricValues,
    datapoints: safeArray(analyticsRuntime.getDataPoints?.()).map((d) => ({
      id: d.id,
      metricId: d.metricId,
      value: d.value,
      timestamp: d.timestamp,
    })),
    generatedAt,
  };
  const reportId = `report_analytics_${sha256(JSON.stringify(fingerprintBase)).slice(0, 16)}`;

  return createAnalyticsIntelligenceReport({
    reportId,
    companyId,
    generatedAt,
    summary,
    overallPerformance,
    kpis,
    trends,
    insights,
    recommendations,
    metrics: metricsList,
    metadata: deepFreeze({
      deterministic: true,
      derivedFrom: { analyticsMetricValues: Object.keys(metricValues).length, datapointCount: safeArray(analyticsRuntime.getDataPoints?.()).length },
      companyHealthProvided: Boolean(companyHealth),
      missionControlProvided: Boolean(missionControl),
      // future: additional deterministic enrichments.
    }),
  });
}

