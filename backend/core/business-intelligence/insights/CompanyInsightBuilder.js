import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  INSIGHT_CATEGORIES,
  INSIGHT_SEVERITIES,
  severityFromDelta,
} from "./CompanyInsightDefaults.js";
import { createCompanyInsight } from "./CompanyInsight.js";
import { compareInsights } from "./CompanyInsightComparator.js";
import { createCompanyInsights } from "./CompanyInsights.js";

// Snapshot extraction helpers
function getCompanyIdFromSnapshots({ previousCompanyHealth, currentCompanyHealth, previousCompanyBrief, currentCompanyBrief } = {}) {
  const cid =
    currentCompanyHealth?.companyId ??
    previousCompanyHealth?.companyId ??
    currentCompanyBrief?.companyId ??
    previousCompanyBrief?.companyId ??
    null;
  if (!cid) return "company";
  return String(cid);
}

function getGeneratedAt(snapshot) {
  return snapshot?.generatedAt ? String(snapshot.generatedAt) : "";
}

function extractHealthComparable(health) {
  if (!health) return null;
  const dimensions = Array.isArray(health.dimensions) ? health.dimensions : [];
  const dimsById = new Map(dimensions.map((d) => [String(d.id), d]));
  const riskArr = Array.isArray(health.risks) ? health.risks : [];
  const recArr = Array.isArray(health.recommendations) ? health.recommendations : [];
  const risksById = new Map(riskArr.map((r) => [String(r.id), r]));
  const recsById = new Map(recArr.map((r) => [String(r.id), r]));

  return {
    overallScore: Number(health.overallScore ?? 0),
    overallStatus: health.overallStatus,
    overallTrend: health.overallTrend,
    dimensions: dimsById,
    risks: risksById,
    recommendations: recsById,
  };
}

function safeCount(v) {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function directionFromScoreDelta(deltaScore, { positiveIsImproved = true } = {}) {
  if (deltaScore === 0) return "unchanged";
  if (deltaScore > 0) return positiveIsImproved ? "improved" : "declined";
  return positiveIsImproved ? "declined" : "improved";
}

function categoryFromDimensionId(dimId) {
  switch (dimId) {
    case "knowledge_health":
      return "knowledge";
    case "communication_health":
      return "communications";
    case "connected_systems_health":
      return "connected_systems";
    case "digital_workforce_health":
      return "workforce";
    case "operational_readiness":
      return "capabilities";
    case "business_profile_health":
    case "company_profile_health":
      return "profile";
    case "workspace_health":
      return "workspace";
    default:
      return "health";
  }
}

function buildInsightId(prefix, parts) {
  return `${prefix}_${parts.map((p) => String(p)).join("_")}`;
}

function confidenceFromScoreDelta(deltaScore) {
  const abs = Math.abs(typeof deltaScore === "number" ? deltaScore : 0);
  if (abs >= 30) return 0.95;
  if (abs >= 15) return 0.85;
  if (abs >= 7) return 0.7;
  return 0.55;
}

function buildExecutiveSummary({ overallDelta, dimensionTopChanges, riskNewCount, riskResolvedCount } = {}) {
  if (overallDelta === 0 && !dimensionTopChanges.length && riskNewCount === 0 && riskResolvedCount === 0) {
    return "No major changes since the previous snapshot.";
  }

  const parts = [];
  if (typeof overallDelta === "number" && overallDelta !== 0) {
    const dir = overallDelta > 0 ? "improved" : "declined";
    parts.push(`Company health ${dir} by ${Math.abs(overallDelta)} points.`);
  }

  if (dimensionTopChanges.length) {
    const [first] = dimensionTopChanges;
    parts.push(`${first.category.replace(/_/g, " ")} ${first.direction}.`);
  }

  if (riskNewCount > 0) parts.push(`${riskNewCount} new risk(s) appeared.`);
  else if (riskResolvedCount > 0) parts.push(`${riskResolvedCount} risk(s) were resolved.`);

  return parts.join(" ");
}

function compareRiskSeverity(riskObj) {
  const id = String(riskObj?.id ?? "");
  if (id.includes("communication")) return 4;
  if (id.includes("disconnected") || id.includes("disconnected_systems")) return 4;
  if (id.includes("approval_backlog")) return 3;
  return 2;
}

function computeSignificanceForBriefChanges(prevBrief, curBrief) {
  const prevDecision = Array.isArray(prevBrief?.decisionsWaiting)
    ? prevBrief.decisionsWaiting.find((d) => d?.id === "decision_review_work_queue") ?? null
    : null;
  const curDecision = Array.isArray(curBrief?.decisionsWaiting)
    ? curBrief.decisionsWaiting.find((d) => d?.id === "decision_review_work_queue") ?? null
    : null;

  const pendingPrev = safeCount(prevDecision?.metadata?.pendingReviews);
  const pendingCur = safeCount(curDecision?.metadata?.pendingReviews);

  // Knowledge count: CompanyBrief doesn't retain knowledge counts everywhere.
  // We only use a deterministic signal when available from priorities/risk metadata.
  const prevKnowledgeSignal = Array.isArray(prevBrief?.priorities)
    ? prevBrief.priorities.find((p) => p?.id === "priority_knowledge_issues") ?? null
    : null;
  const curKnowledgeSignal = Array.isArray(curBrief?.priorities)
    ? curBrief.priorities.find((p) => p?.id === "priority_knowledge_issues") ?? null
    : null;
  const knowledgePrev = safeCount(prevKnowledgeSignal?.metadata?.count);
  const knowledgeCur = safeCount(curKnowledgeSignal?.metadata?.count);

  const totalActPrev = safeCount(prevBrief?.activitySummary?.totalActivities);
  const totalActCur = safeCount(curBrief?.activitySummary?.totalActivities);

  return {
    pendingPrev,
    pendingCur,
    knowledgePrev,
    knowledgeCur,
    totalActPrev,
    totalActCur,
  };
}

function buildBriefDerivedInsights({ previousCompanyBrief, currentCompanyBrief } = {}) {
  if (!previousCompanyBrief || !currentCompanyBrief) return [];

  const prev = previousCompanyBrief;
  const cur = currentCompanyBrief;
  const derived = computeSignificanceForBriefChanges(prev, cur);

  const pendingDelta = derived.pendingCur - derived.pendingPrev;
  const knowledgeDelta = derived.knowledgeCur - derived.knowledgePrev;
  const activityDelta = derived.totalActCur - derived.totalActPrev;

  const insights = [];

  // Work queue: pending reviews increasing is negative for governance.
  if (pendingDelta !== 0) {
    const direction = pendingDelta > 0 ? "declined" : "improved";
    insights.push(
      createCompanyInsight({
        id: buildInsightId("ins_work_queue_pending", [pendingDelta, prev.briefId ?? "", cur.briefId ?? ""]),
        title: "Pending review work changed",
        summary: `Pending review count changed from ${derived.pendingPrev} to ${derived.pendingCur}.`,
        category: "work_queue",
        direction,
        severity: severityFromDelta({ deltaCount: Math.abs(pendingDelta), deltaScore: null, riskNew: false }),
        confidence: 0.7,
        before: derived.pendingPrev,
        after: derived.pendingCur,
        delta: pendingDelta,
        source: "company_brief",
        recommendedAction: null,
        metadata: deepFreeze({ pendingDelta }),
      }),
    );
  }

  // Knowledge count change.
  if (knowledgeDelta !== 0) {
    const direction = knowledgeDelta > 0 ? "improved" : "declined";
    insights.push(
      createCompanyInsight({
        id: buildInsightId("ins_knowledge_count", [knowledgeDelta, prev.briefId ?? "", cur.briefId ?? ""]),
        title: "Knowledge inventory changed",
        summary: `Active knowledge count changed from ${derived.knowledgePrev} to ${derived.knowledgeCur}.`,
        category: "knowledge",
        direction,
        severity: severityFromDelta({ deltaCount: Math.abs(knowledgeDelta), deltaScore: null, riskNew: false }),
        confidence: 0.65,
        before: derived.knowledgePrev,
        after: derived.knowledgeCur,
        delta: knowledgeDelta,
        source: "company_brief",
        recommendedAction: null,
        metadata: deepFreeze({ knowledgeDelta }),
      }),
    );
  }

  // Activities volume changes.
  if (activityDelta !== 0) {
    const direction = activityDelta > 0 ? "improved" : "declined";
    insights.push(
      createCompanyInsight({
        id: buildInsightId("ins_activity_volume", [activityDelta, prev.briefId ?? "", cur.briefId ?? ""]),
        title: "Activity volume changed",
        summary: `Total activity count changed from ${derived.totalActPrev} to ${derived.totalActCur}.`,
        category: "activities",
        direction,
        severity: severityFromDelta({ deltaCount: Math.abs(activityDelta), deltaScore: null, riskNew: false }),
        confidence: 0.55,
        before: derived.totalActPrev,
        after: derived.totalActCur,
        delta: activityDelta,
        source: "company_brief",
        recommendedAction: null,
        metadata: deepFreeze({ activityDelta }),
      }),
    );
  }

  return insights;
}

function buildHealthDerivedInsights({ previousCompanyHealth, currentCompanyHealth } = {}) {
  const prevComp = extractHealthComparable(previousCompanyHealth);
  const curComp = extractHealthComparable(currentCompanyHealth);
  if (!prevComp || !curComp) return [];

  const insights = [];

  // Overall health change.
  const overallDelta = curComp.overallScore - prevComp.overallScore;
  if (overallDelta !== 0) {
    const direction = overallDelta > 0 ? "improved" : "declined";
    const severity = severityFromDelta({ deltaScore: overallDelta, riskNew: false, deltaCount: null });
    insights.push(
      createCompanyInsight({
        id: `ins_overall_health_${String(overallDelta)}`,
        title: "Overall health changed",
        summary: `Overall score moved from ${prevComp.overallScore} to ${curComp.overallScore}.`,
        category: "health",
        direction,
        severity,
        confidence: confidenceFromScoreDelta(overallDelta),
        before: prevComp.overallScore,
        after: curComp.overallScore,
        delta: overallDelta,
        source: "company_health:overall",
        recommendedAction: null,
        metadata: deepFreeze({ overallDelta }),
      }),
    );
  }

  // Dimension changes.
  const allDimIds = new Set([...prevComp.dimensions.keys(), ...curComp.dimensions.keys()]);
  const dimensionTopChanges = [];
  for (const dimId of allDimIds) {
    const prevDim = prevComp.dimensions.get(dimId) ?? null;
    const curDim = curComp.dimensions.get(dimId) ?? null;

    if (!prevDim && curDim) {
      insights.push(
        createCompanyInsight({
          id: `ins_dim_new_${dimId}`,
          title: `${dimId} appeared`,
          summary: "A new health dimension is present in the current snapshot.",
          category: categoryFromDimensionId(dimId),
          direction: "new",
          severity: "medium",
          confidence: 0.5,
          before: null,
          after: curDim.score,
          delta: null,
          source: `company_health:dimension:${dimId}`,
          recommendedAction: null,
          metadata: deepFreeze({ dimId }),
        }),
      );
      continue;
    }
    if (prevDim && !curDim) {
      insights.push(
        createCompanyInsight({
          id: `ins_dim_resolved_${dimId}`,
          title: `${dimId} was resolved`,
          summary: "A health dimension is no longer present in the current snapshot.",
          category: categoryFromDimensionId(dimId),
          direction: "resolved",
          severity: "info",
          confidence: 0.45,
          before: prevDim.score,
          after: null,
          delta: null,
          source: `company_health:dimension:${dimId}`,
          recommendedAction: null,
          metadata: deepFreeze({ dimId }),
        }),
      );
      continue;
    }
    if (!prevDim || !curDim) continue;

    const deltaScore = curDim.score - prevDim.score;
    if (deltaScore === 0) {
      // Only create insights when explicitly significant; changed snapshots tests may still want unchanged classification.
      continue;
    }

    const direction = deltaScore > 0 ? "improved" : "declined";
    const severity = severityFromDelta({ deltaScore, riskNew: false });
    const category = categoryFromDimensionId(dimId);
    dimensionTopChanges.push({ category, direction });

    insights.push(
      createCompanyInsight({
        id: `ins_dim_${dimId}_${String(deltaScore)}`,
        title: `${curDim.title} changed`,
        summary: `${curDim.title} score moved from ${prevDim.score} to ${curDim.score}.`,
        category,
        direction,
        severity,
        confidence: confidenceFromScoreDelta(deltaScore),
        before: prevDim.score,
        after: curDim.score,
        delta: deltaScore,
        source: `company_health:dimension:${dimId}`,
        recommendedAction: null,
        metadata: deepFreeze({ dimId, deltaScore }),
      }),
    );
  }

  // Risk changes: new/removed risks.
  const prevRiskIds = [...prevComp.risks.keys()];
  const curRiskIds = [...curComp.risks.keys()];
  const prevRiskSet = new Set(prevRiskIds);
  const curRiskSet = new Set(curRiskIds);
  const riskNew = curRiskIds.filter((id) => !prevRiskSet.has(id));
  const riskResolved = prevRiskIds.filter((id) => !curRiskSet.has(id));

  for (const id of riskNew) {
    const r = curComp.risks.get(id);
    const severity = "high";
    insights.push(
      createCompanyInsight({
        id: `ins_risk_new_${id}`,
        title: "New risk appeared",
        summary: r?.summary ? String(r.summary) : `Risk ${id} appeared.`,
        category: "health",
        direction: "new",
        severity,
        confidence: 0.8,
        before: null,
        after: id,
        delta: null,
        source: `company_health:risk:${id}`,
        recommendedAction: null,
        metadata: deepFreeze({ riskId: id }),
      }),
    );
  }
  for (const id of riskResolved) {
    const r = prevComp.risks.get(id);
    insights.push(
      createCompanyInsight({
        id: `ins_risk_resolved_${id}`,
        title: "Risk resolved",
        summary: r?.summary ? String(r.summary) : `Risk ${id} was resolved.`,
        category: "health",
        direction: "resolved",
        severity: "medium",
        confidence: 0.75,
        before: id,
        after: null,
        delta: null,
        source: `company_health:risk:${id}`,
        recommendedAction: null,
        metadata: deepFreeze({ riskId: id }),
      }),
    );
  }

  // Recommendation changes.
  const prevRecIds = [...prevComp.recommendations.keys()];
  const curRecIds = [...curComp.recommendations.keys()];
  const prevRecSet = new Set(prevRecIds);
  const curRecSet = new Set(curRecIds);
  const recNew = curRecIds.filter((id) => !prevRecSet.has(id));
  const recResolved = prevRecIds.filter((id) => !curRecSet.has(id));

  for (const id of recNew) {
    const rec = curComp.recommendations.get(id);
    insights.push(
      createCompanyInsight({
        id: `ins_rec_new_${id}`,
        title: "New recommendation",
        summary: rec?.label ? String(rec.label) : `Recommendation ${id} added.`,
        category: rec?.target === "communications" ? "communications" : rec?.target?.includes("knowledge") ? "knowledge" : "health",
        direction: "new",
        severity: "low",
        confidence: 0.6,
        before: null,
        after: id,
        delta: null,
        source: `company_health:recommendation:${id}`,
        recommendedAction: {
          id,
          label: rec?.label ?? id,
          type: rec?.type ?? "ACTION",
          target: rec?.target ?? "unknown",
          priority: rec?.priority ?? "MEDIUM",
          metadata: rec?.metadata ?? {},
        },
        metadata: deepFreeze({ recId: id }),
      }),
    );
  }

  for (const id of recResolved) {
    const rec = prevComp.recommendations.get(id);
    insights.push(
      createCompanyInsight({
        id: `ins_rec_resolved_${id}`,
        title: "Recommendation resolved",
        summary: rec?.label ? String(rec.label) : `Recommendation ${id} was resolved.`,
        category: "health",
        direction: "resolved",
        severity: "info",
        confidence: 0.55,
        before: id,
        after: null,
        delta: null,
        source: `company_health:recommendation:${id}`,
        recommendedAction: null,
        metadata: deepFreeze({ recId: id }),
      }),
    );
  }

  // Build executive summary
  const riskNewCount = riskNew.length;
  const riskResolvedCount = riskResolved.length;
  const summaryDimensionTop = dimensionTopChanges.slice(0, 1);
  const summary = buildExecutiveSummary({
    overallDelta,
    dimensionTopChanges: summaryDimensionTop,
    riskNewCount,
    riskResolvedCount,
  });

  return { insights, summary };
}

export function buildCompanyInsights({
  previousCompanyHealth,
  currentCompanyHealth,
  previousCompanyBrief,
  currentCompanyBrief,
  previousRuntimeSnapshot,
  currentRuntimeSnapshot,
  nowISO,
} = {}) {
  const companyId = getCompanyIdFromSnapshots({
    previousCompanyHealth,
    currentCompanyHealth,
    previousCompanyBrief,
    currentCompanyBrief,
  });

  const prevGeneratedAt = getGeneratedAt(currentCompanyHealth ? previousCompanyHealth : previousCompanyBrief);
  const curGeneratedAt = getGeneratedAt(currentCompanyHealth ? currentCompanyHealth : currentCompanyBrief);

  const comparisonWindow = deepFreeze({
    previousGeneratedAt: prevGeneratedAt,
    currentGeneratedAt: curGeneratedAt,
    mode: {
      health: Boolean(previousCompanyHealth && currentCompanyHealth),
      brief: Boolean(previousCompanyBrief && currentCompanyBrief),
      runtime: Boolean(previousRuntimeSnapshot && currentRuntimeSnapshot),
    },
  });

  const briefInsights = buildBriefDerivedInsights({
    previousCompanyBrief,
    currentCompanyBrief,
  });

  const healthPack = buildHealthDerivedInsights({
    previousCompanyHealth,
    currentCompanyHealth,
  });

  const healthInsights = healthPack?.insights ?? [];
  const summaryBase = healthPack?.summary ?? "";

  const allInsights = [...healthInsights, ...briefInsights]
    .sort(compareInsights);

  // Classification into positive/negative/neutral based on source and direction.
  const positiveChanges = [];
  const negativeChanges = [];
  const neutralChanges = [];
  const notableChanges = [];

  for (const i of allInsights) {
    notableChanges.push(i.id);

    const src = String(i.source ?? "");
    const isRisk = src.includes(":risk:");
    const isRecommendation = src.includes(":recommendation:");
    const isWorkQueue = i.category === "work_queue";

    let sign = "neutral";
    if (isRisk) {
      sign = i.direction === "new" ? "negative" : i.direction === "resolved" ? "positive" : "neutral";
    } else if (isRecommendation) {
      sign = i.direction === "new" ? "positive" : i.direction === "resolved" ? "positive" : "neutral";
    } else if (isWorkQueue) {
      sign = i.direction === "declined" ? "negative" : i.direction === "improved" ? "positive" : "neutral";
    } else {
      sign = i.direction === "improved" ? "positive" : i.direction === "declined" ? "negative" : i.direction === "resolved" ? "positive" : "neutral";
    }

    if (sign === "positive") positiveChanges.push(i.id);
    else if (sign === "negative") negativeChanges.push(i.id);
    else neutralChanges.push(i.id);
  }

  // Recommended attention: highest severity insights.
  const severeOrder = ["critical", "high", "medium"];
  const recommendedAttention = allInsights
    .filter((i) => severeOrder.includes(String(i.severity)))
    .slice(0, 7)
    .map((i) => ({
      id: `attn_${i.id}`,
      insightId: i.id,
      label: i.title,
      category: i.category,
      priority: i.severity === "critical" ? "HIGH" : i.severity === "high" ? "HIGH" : "MEDIUM",
      type: "ATTENTION",
      target: i.category,
      metadata: i.metadata ?? {},
    }));

  // Exec summary: use health-derived summary when available; otherwise deterministic brief-driven summary.
  let summary = summaryBase;
  if (!summary) {
    if (!allInsights.length) summary = "No major changes since the previous snapshot.";
    else summary = "Changes were detected in the company snapshot.";
  }

  const insightsId = `insights_${companyId}_${String(nowISO ?? "2026-07-01T00:00:00.000Z")}`;

  const insightsObj = createCompanyInsights({
    insightsId,
    companyId,
    generatedAt: nowISO ?? "2026-07-01T00:00:00.000Z",
    comparisonWindow,
    summary,
    insights: allInsights,
    notableChanges,
    positiveChanges,
    negativeChanges,
    neutralChanges,
    recommendedAttention,
    metadata: deepFreeze({ input: comparisonWindow.mode }),
  });

  return insightsObj;
}

