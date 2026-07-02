import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  HEALTH_DIMENSIONS,
  HEALTH_STATUS,
  STATUS_IS_RISK,
  STATUS_IS_STRENGTH,
  STATUS_BY_SCORE,
  TREND,
  TREND_FROM_SCORE,
  clampScore,
} from "./CompanyHealthDefaults.js";
import { scoreToConfidence, scoreToStatus, scoreToTrend, computeOverallScore } from "./CompanyHealthScore.js";
import { createCompanyHealthDimension } from "./CompanyHealthDimension.js";
import { createCompanyHealthRecommendation } from "./CompanyHealthRecommendation.js";
import { createCompanyHealth } from "./CompanyHealth.js";

function summarizeByScore(score) {
  if (score >= 80) return "Strong health signal.";
  if (score <= 40) return "Needs attention based on current signals.";
  return "Moderate health signal.";
}

function countReadyStatuses(connectedSystems) {
  const list = Array.isArray(connectedSystems) ? connectedSystems : [];
  const total = list.length || 1;
  const ready = list.filter((s) => {
    const st = String(s?.status ?? "");
    return st === "READY" || st === "HEALTHY";
  }).length;
  return { ready, total, disconnected: list.length - ready };
}

function computeKnowledgeSignals(companyRuntime) {
  const repo = companyRuntime.getKnowledgeRepository?.() ?? { items: [] };
  const items = Array.isArray(repo.items) ? repo.items : [];
  const activeCount = items.filter((i) => i && i.status !== "ARCHIVED").length;
  const archivedCount = items.filter((i) => i && i.status === "ARCHIVED").length;
  return {
    activeCount,
    archivedCount,
    hasData: items.length > 0,
    empty: activeCount === 0,
  };
}

function computeCommunicationSignals(companyRuntime) {
  const setup = companyRuntime.getCommunicationSetup?.() ?? {};
  const r = setup.readiness ?? {};
  const flags = [
    Boolean(r.emailReady),
    Boolean(r.smsReady),
    Boolean(r.brandReady),
    Boolean(r.quietHoursReady),
    Boolean(r.approvalPolicyReady),
  ];
  const readyCount = flags.filter(Boolean).length;
  return {
    hasData: true,
    readyCount,
    total: flags.length,
    flags,
  };
}

function computeWorkforceSignals(companyRuntime) {
  const employees = companyRuntime.getEmployees?.() ?? [];
  const list = Array.isArray(employees) ? employees : [];
  const total = list.length || 1;
  const offline = list.filter((e) => e?.status === "Offline").length;
  const active = list.filter((e) => e?.status === "Working" || e?.status === "Needs Review").length;
  const waiting = list.filter((e) => (e?.currentWorkload?.waitingOnYouCount ?? 0) > 0).length;
  return { total, offline, active, waiting, hasData: list.length > 0 };
}

function computeOperationalSignals(companyRuntime, capabilityEngine, nowISO) {
  const engine = capabilityEngine;
  const capabilityEval = engine?.evaluate?.({
    companyRuntime,
    onboardingRuntime: undefined,
    nowISO,
  }) ?? { overallReadiness: "UNKNOWN", overallHealth: "UNKNOWN" };

  const readiness = String(capabilityEval?.overallReadiness ?? "UNKNOWN");
  // Deterministic score mapping.
  const score =
    readiness === "READY" ? 90 : readiness === "IN_PROGRESS" ? 60 : readiness === "DEGRADED" ? 45 : 30;
  const hasData = readiness !== "UNKNOWN";
  return { capabilityEval, score, readiness, hasData };
}

function computeBusinessProfileSignals(companyRuntime) {
  const bp = companyRuntime.getBusinessProfile?.() ?? {};
  const completionStatus = bp?.metadata?.completionStatus ?? bp?.metadata?.completionStatus ?? "";
  const completionPercent = Number(bp?.metadata?.completionPercent ?? 0);
  const hasData = typeof completionStatus === "string";
  const score = completionStatus === "COMPLETE" ? 90 : completionPercent > 0 ? 60 : 30;
  return { completionStatus, completionPercent, score, hasData };
}

function computeCompanyProfileSignals(companyRuntime) {
  const cp = companyRuntime.getCompanyProfile?.() ?? {};
  const completionStatus = cp?.metadata?.completionStatus ?? "";
  const completionPercent = Number(cp?.metadata?.completionPercent ?? 0);
  const hasData = typeof completionStatus === "string";
  const score = completionStatus === "COMPLETE" ? 90 : completionPercent > 0 ? 60 : 30;
  return { completionStatus, completionPercent, score, hasData };
}

function computeWorkspaceSignals(workspaceConfig) {
  const cfg = workspaceConfig ?? {};
  const moduleCount = Array.isArray(cfg.modules) ? cfg.modules.length : 0;
  const navCount = Array.isArray(cfg.navigation?.items) ? cfg.navigation.items.length : 0;
  const queueCount = Array.isArray(cfg.queues) ? cfg.queues.length : 0;
  // Deterministic: more modules => higher.
  const raw = moduleCount * 10 + queueCount * 5 + navCount * 3;
  const score = raw >= 100 ? 100 : raw;
  return { moduleCount, navCount, queueCount, score, hasData: true };
}

function scoreWithStrength(hasData, strength, score) {
  return {
    score,
    hasData,
    strength,
    confidence: scoreToConfidence({ hasData, strength }),
  };
}

function buildDimensionRecommendations({ id, status } = {}) {
  // Dimension-specific recommendations can be embedded in dimension.recommendations.
  // Canonical CompanyHealthRecommendation objects live in strengths/risks/recommendations too.
  return deepFreeze(
    (id === "connected_systems_health" && STATUS_IS_RISK(status)
      ? [createCompanyHealthRecommendation({ id: "rec_reconnect_email", label: "Reconnect Email", type: "INTEGRATIONS", target: "email", priority: "MEDIUM", metadata: {} })]
      : []),
  );
}

export function buildCompanyHealth({
  companyRuntime,
  companyBrief,
  capabilityEngine,
  workspaceConfig,
  nowISO,
} = {}) {
  if (!companyRuntime) throw new Error("CompanyHealthBuilder: companyRuntime required.");
  const effectiveNowISO = nowISO ?? "2026-07-01T00:00:00.000Z";

  const knowledgeSignals = computeKnowledgeSignals(companyRuntime);
  const knowledgeScore = knowledgeSignals.hasData
    ? knowledgeSignals.activeCount > 0
      ? clampScore(knowledgeSignals.activeCount * 12 + (knowledgeSignals.archivedCount > 0 ? 5 : 0))
      : 0
    : 0;
  const knowledgeStatus = scoreToStatus(knowledgeScore);
  const knowledgeTrend = scoreToTrend(knowledgeScore);

  const commSignals = computeCommunicationSignals(companyRuntime);
  const commScore = clampScore((commSignals.readyCount / commSignals.total) * 100);
  const commStatus = scoreToStatus(commScore);
  const commTrend = scoreToTrend(commScore);

  const connected = companyRuntime.getConnectedSystems?.() ?? [];
  const cs = countReadyStatuses(connected);
  const csScore = clampScore((cs.ready / cs.total) * 100);
  const csStatus = scoreToStatus(csScore);
  const csTrend = scoreToTrend(csScore);

  const workforceSignals = computeWorkforceSignals(companyRuntime);
  const workforceScoreRaw =
    ((workforceSignals.active + workforceSignals.waiting * 0.5) / workforceSignals.total) * 100 -
    (workforceSignals.offline / workforceSignals.total) * 20;
  const workforceScore = clampScore(workforceScoreRaw);
  const workforceStatus = scoreToStatus(workforceScore);
  const workforceTrend = scoreToTrend(workforceScore);

  const engine = capabilityEngine;
  const operational = computeOperationalSignals(companyRuntime, engine, effectiveNowISO);
  const opScore = operational.score;
  const opStatus = scoreToStatus(opScore);
  const opTrend = scoreToTrend(opScore);

  const bp = computeBusinessProfileSignals(companyRuntime);
  const bpStatus = scoreToStatus(bp.score);
  const bpTrend = scoreToTrend(bp.score);

  const cp = computeCompanyProfileSignals(companyRuntime);
  const cpStatus = scoreToStatus(cp.score);
  const cpTrend = scoreToTrend(cp.score);

  const ws = computeWorkspaceSignals(workspaceConfig);
  const wsStatus = scoreToStatus(ws.score);
  const wsTrend = scoreToTrend(ws.score);

  const dims = [
    createCompanyHealthDimension({
      id: "knowledge_health",
      title: "Knowledge Health",
      score: knowledgeScore,
      status: knowledgeStatus,
      trend: knowledgeTrend,
      confidence: scoreToConfidence({ hasData: knowledgeSignals.hasData, strength: STATUS_IS_STRENGTH(knowledgeStatus) }),
      summary: knowledgeSignals.empty ? "Knowledge is empty or archived." : "Knowledge is available and active.",
      recommendations: [],
      metadata: deepFreeze({ activeCount: knowledgeSignals.activeCount, archivedCount: knowledgeSignals.archivedCount }),
    }),
    createCompanyHealthDimension({
      id: "communication_health",
      title: "Communication Health",
      score: commScore,
      status: commStatus,
      trend: commTrend,
      confidence: scoreToConfidence({ hasData: true, strength: STATUS_IS_STRENGTH(commStatus) }),
      summary: commSignals.readyCount === commSignals.total ? "Communications are healthy." : "Communications are not fully ready.",
      recommendations: [],
      metadata: deepFreeze({ readyCount: commSignals.readyCount, flags: commSignals.flags }),
    }),
    createCompanyHealthDimension({
      id: "connected_systems_health",
      title: "Connected Systems Health",
      score: csScore,
      status: csStatus,
      trend: csTrend,
      confidence: scoreToConfidence({ hasData: true, strength: STATUS_IS_STRENGTH(csStatus) }),
      summary: cs.disconnected === 0 ? "Connected systems are healthy." : "Some connected systems require attention.",
      recommendations: [],
      metadata: deepFreeze({ ready: cs.ready, total: cs.total, disconnected: cs.disconnected }),
    }),
    createCompanyHealthDimension({
      id: "digital_workforce_health",
      title: "Digital Workforce Health",
      score: workforceScore,
      status: workforceStatus,
      trend: workforceTrend,
      confidence: scoreToConfidence({ hasData: workforceSignals.hasData, strength: STATUS_IS_STRENGTH(workforceStatus) }),
      summary:
        workforceSignals.offline === workforceSignals.total
          ? "All employees are offline."
          : workforceSignals.waiting > 0
            ? "Employees are active but waiting on your governance."
            : "Employees are active and not blocked on your review.",
      recommendations: [],
      metadata: deepFreeze({
        offline: workforceSignals.offline,
        active: workforceSignals.active,
        waiting: workforceSignals.waiting,
      }),
    }),
    createCompanyHealthDimension({
      id: "operational_readiness",
      title: "Operational Readiness",
      score: opScore,
      status: opStatus,
      trend: opTrend,
      confidence: scoreToConfidence({ hasData: operational.hasData, strength: STATUS_IS_STRENGTH(opStatus) }),
      summary:
        opStatus === "EXCELLENT"
          ? "Operational readiness is excellent."
          : opStatus === "GOOD"
            ? "Operational readiness is good."
            : "Operational readiness needs improvement.",
      recommendations: [],
      metadata: deepFreeze({
        readiness: operational.readiness,
        overallHealth: operational.capabilityEval?.overallHealth ?? "UNKNOWN",
      }),
    }),
    createCompanyHealthDimension({
      id: "business_profile_health",
      title: "Business Profile Health",
      score: bp.score,
      status: bpStatus,
      trend: bpTrend,
      confidence: scoreToConfidence({ hasData: bp.hasData, strength: STATUS_IS_STRENGTH(bpStatus) }),
      summary: bp.completionStatus === "COMPLETE" ? "Business profile is complete." : "Business profile is not complete.",
      recommendations: [],
      metadata: deepFreeze({ completionStatus: bp.completionStatus, completionPercent: bp.completionPercent }),
    }),
    createCompanyHealthDimension({
      id: "company_profile_health",
      title: "Company Profile Health",
      score: cp.score,
      status: cpStatus,
      trend: cpTrend,
      confidence: scoreToConfidence({ hasData: cp.hasData, strength: STATUS_IS_STRENGTH(cpStatus) }),
      summary: cp.completionStatus === "COMPLETE" ? "Company profile is complete." : "Company profile is not complete.",
      recommendations: [],
      metadata: deepFreeze({ completionStatus: cp.completionStatus, completionPercent: cp.completionPercent }),
    }),
    createCompanyHealthDimension({
      id: "workspace_health",
      title: "Workspace Health",
      score: ws.score,
      status: wsStatus,
      trend: wsTrend,
      confidence: scoreToConfidence({ hasData: ws.hasData, strength: STATUS_IS_STRENGTH(wsStatus) }),
      summary: "Workspace shell and operating surfaces are provisioned for execution.",
      recommendations: [],
      metadata: deepFreeze({ moduleCount: ws.moduleCount, queueCount: ws.queueCount }),
    }),
  ];

  const dimensionScores = dims.map((d) => d.score);
  const overallScore = computeOverallScore(dimensionScores);
  const overallStatus = scoreToStatus(overallScore);
  const overallTrend = scoreToTrend(overallScore);
  const overallConfidence = dims.reduce((acc, d) => acc + Number(d.confidence ?? 0), 0) / (dims.length || 1);

  // Strengths & risks.
  const strengths = [];
  const risks = [];

  const addStrength = (id, label, summary, metadata) => {
    strengths.push(
      deepFreeze({
        id,
        label,
        summary: String(summary ?? ""),
        metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
      }),
    );
  };
  const addRisk = (id, label, summary, metadata) => {
    risks.push(
      deepFreeze({
        id,
        label,
        summary: String(summary ?? ""),
        metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
      }),
    );
  };

  if (knowledgeSignals.activeCount > 0) addStrength("strength_knowledge_complete", "Knowledge complete", "Active knowledge is available for governance and drafting.", { activeCount: knowledgeSignals.activeCount });
  if (workforceSignals.active > 0) addStrength("strength_employees_active", "Employees active", "Digital employees are actively producing draft work.", { active: workforceSignals.active, waiting: workforceSignals.waiting });
  if (commSignals.readyCount === commSignals.total) addStrength("strength_healthy_communications", "Healthy communications", "Communication readiness signals are healthy.", { flags: commSignals.flags });
  const profilesCompleted = bp.completionStatus === "COMPLETE" && cp.completionStatus === "COMPLETE";
  if (profilesCompleted) addStrength("strength_profiles_completed", "Profiles completed", "Business and company profiles are complete.", { business: bp.completionStatus, company: cp.completionStatus });
  if (cs.disconnected === 0 && connected.length > 0) addStrength("strength_connected_systems_healthy", "Connected systems healthy", "Connected systems are healthy and ready.", { ready: cs.ready, total: cs.total });

  if (cs.disconnected > 0) addRisk("risk_disconnected_systems", "Disconnected systems", `${cs.disconnected} connected system(s) require attention.`, { disconnected: cs.disconnected });
  if (commSignals.readyCount < commSignals.total) addRisk("risk_communication_readiness", "Communication failures", "Communication readiness signals are incomplete.", { readyCount: commSignals.readyCount });
  if (knowledgeSignals.activeCount === 0) addRisk("risk_empty_knowledge", "Empty knowledge", "No active knowledge is available.", {});
  if (workforceSignals.waiting > 0) addRisk("risk_approval_backlog", "Approval backlog", `${workforceSignals.waiting} employee(s) are waiting on your governance.`, { waiting: workforceSignals.waiting });
  if (bp.completionStatus !== "COMPLETE" || cp.completionStatus !== "COMPLETE") addRisk("risk_missing_profiles", "Missing profiles", "Business and/or company profile completion is not complete.", { business: bp.completionStatus, company: cp.completionStatus });
  if (operational.readiness !== "READY") addRisk("risk_readiness_degradation", "Readiness degradation", `Operational readiness is ${operational.readiness}.`, { readiness: operational.readiness });

  // Recommendations generation (deterministic).
  const recs = [];
  const addRec = (rec) => {
    recs.push(rec);
  };

  // Ensure reconnect recommendations for disconnected systems by provider category.
  const connectedList = Array.isArray(connected) ? connected : [];
  for (const s of connectedList) {
    const status = String(s?.status ?? "");
    if (status === "READY") continue;
    const provider = String(s?.provider ?? "");
    if (provider === "email") {
      addRec(
        createCompanyHealthRecommendation({
          id: "rec_reconnect_email",
          label: "Reconnect Gmail",
          type: "INTEGRATIONS",
          target: "email",
          priority: "MEDIUM",
          metadata: { systemId: s?.id },
        }),
      );
    } else if (provider === "crm") {
      addRec(
        createCompanyHealthRecommendation({
          id: "rec_connect_crm",
          label: "Connect CRM",
          type: "INTEGRATIONS",
          target: "crm",
          priority: "MEDIUM",
          metadata: { systemId: s?.id },
        }),
      );
    }
  }

  if (knowledgeSignals.activeCount === 0) {
    addRec(
      createCompanyHealthRecommendation({
        id: "rec_publish_knowledge",
        label: "Publish Knowledge",
        type: "KNOWLEDGE",
        target: "knowledge_repository",
        priority: "MEDIUM",
        metadata: {},
      }),
    );
  }

  if (bp.completionStatus !== "COMPLETE" || cp.completionStatus !== "COMPLETE") {
    addRec(
      createCompanyHealthRecommendation({
        id: "rec_complete_onboarding",
        label: "Complete Onboarding",
        type: "BUSINESS",
        target: "profiles",
        priority: "HIGH",
        metadata: { business: bp.completionStatus, company: cp.completionStatus },
      }),
    );
  }

  if (workforceSignals.waiting > 0) {
    addRec(
      createCompanyHealthRecommendation({
        id: "rec_review_pending_work",
        label: "Review Pending Work",
        type: "GOVERNANCE",
        target: "work_queue",
        priority: "HIGH",
        metadata: { waiting: workforceSignals.waiting },
      }),
    );
  }

  // Communication readiness: recommend reconnecting email when brand/email are missing.
  if (commSignals.readyCount < commSignals.total) {
    addRec(
      createCompanyHealthRecommendation({
        id: "rec_improve_communications",
        label: "Improve Communication Readiness",
        type: "COMMUNICATIONS",
        target: "communications",
        priority: "MEDIUM",
        metadata: { readyCount: commSignals.readyCount },
      }),
    );
  }

  // Capability gaps: deterministic operational readiness recommendation.
  if (operational.readiness !== "READY") {
    addRec(
      createCompanyHealthRecommendation({
        id: "rec_review_operational_readiness",
        label: "Review Pending Work",
        type: "READINESS",
        target: "capabilities",
        priority: "MEDIUM",
        metadata: { readiness: operational.readiness },
      }),
    );
  }

  // Dedup by id.
  const seen = new Set();
  const uniqueRecs = [];
  for (const r of recs) {
    if (!r?.id) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    uniqueRecs.push(r);
  }

  // Deterministic order by priority then id.
  uniqueRecs.sort((a, b) => {
    const pr = (p) => (p === "HIGH" ? 0 : p === "MEDIUM" ? 1 : 2);
    return pr(a.priority) - pr(b.priority) || a.id.localeCompare(b.id);
  });

  // Dimension recommendations: embed the same list subset for traceability.
  const recsByType = new Map();
  for (const r of uniqueRecs) {
    const prev = recsByType.get(r.target) ?? [];
    recsByType.set(r.target, [...prev, r]);
  }

  for (const d of dims) {
    // dimensions are frozen already; but builder should not mutate. Keep empty here.
    void d;
  }

  const recList = deepFreeze(uniqueRecs);

  // Executive summary: deterministic sentence composition.
  const disconnectedCount = cs.disconnected;
  const knowledgeStrength = knowledgeSignals.activeCount > 0;
  const commHealthy = commSignals.readyCount === commSignals.total;

  const summaryParts = [];
  summaryParts.push(overallStatus === HEALTH_STATUS.EXCELLENT || overallStatus === HEALTH_STATUS.GOOD ? "The business is healthy overall." : "The business needs attention overall.");
  summaryParts.push(knowledgeStrength ? "Knowledge is a strength." : "Knowledge requires attention.");
  summaryParts.push(commHealthy ? "Communications are healthy." : "Communications are not fully ready.");
  summaryParts.push(disconnectedCount > 0 ? "Connected systems require attention." : "Connected systems are healthy.");
  const summary = summaryParts.join(" ");

  const recommendedRecommendations = recList; // canonical

  return createCompanyHealth({
    healthId: `health_${String(companyRuntime.getCompany?.()?.companyName ?? "company").replace(/\s+/g, "_")}_${effectiveNowISO}`,
    companyId: String(companyRuntime.getCompany?.()?.companyName ?? "company"),
    generatedAt: effectiveNowISO,
    overallScore,
    overallStatus,
    overallTrend,
    overallConfidence: Number(overallConfidence),
    dimensions: dims,
    strengths: deepFreeze(strengths),
    risks: deepFreeze(risks),
    recommendations: recommendedRecommendations,
    summary,
    metadata: deepFreeze({
      generatedBy: "CompanyHealthEngine",
      version: 1,
      capabilityOverallReadiness: operational.readiness,
      pendingKnowledge: knowledgeSignals.empty,
    }),
  });
}

