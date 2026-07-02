import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createCompanyRecommendation } from "./CompanyRecommendation.js";
import { RECOMMENDATION_EFFORT, RECOMMENDATION_IMPACT } from "./CompanyRecommendationDefaults.js";

import {
  RECOMMENDATION_CATEGORIES,
  INSIGHT_SEVERITY_TO_IMPACT,
  OPPORTUNITY_IMPACT_TO_IMPACT,
} from "./CompanyRecommendationDefaults.js";

function fail(message) {
  throw new Error(`CompanyRecommendationBuilder: ${message}`);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeCategoryFromOpportunityCategory(category) {
  const c = String(category ?? "");
  if (RECOMMENDATION_CATEGORIES.includes(c)) return c;
  // Opportunity categories should already align, but keep deterministic fallback.
  if (c === "workspace_health") return "workspace";
  return "operations";
}

function categoryFromDecisionTarget(target) {
  const t = String(target ?? "");
  if (t === "work_queue") return "work_queue";
  if (t === "communications") return "communications";
  if (t === "digital_workforce") return "digital_workforce";
  if (t === "onboarding") return "onboarding";
  if (t === "business_profile") return "business_profile";
  if (t === "company_profile") return "company_profile";
  return "operations";
}

function categoryFromRiskId(riskId) {
  const id = String(riskId ?? "");
  if (id === "risk_communication_failures") return "communications";
  if (id === "risk_disconnected_systems") return "connected_systems";
  if (id === "risk_knowledge_publish_ingestion_failures" || id === "risk_empty_knowledge") return "knowledge";
  if (id === "risk_approval_backlog") return "work_queue";
  if (id === "risk_blocked_capabilities") return "operations";
  if (id === "risk_missing_profile_business_setup") return "business_profile";
  return "operations";
}

function categoryFromInsightCategory(insightCategory) {
  const c = String(insightCategory ?? "");
  if (c === "knowledge") return "knowledge";
  if (c === "communications") return "communications";
  if (c === "connected_systems") return "connected_systems";
  if (c === "workforce") return "digital_workforce";
  if (c === "work_queue") return "work_queue";
  if (c === "profile") return "business_profile";
  if (c === "workspace") return "workspace";
  // capabilities/health/activities map to operations.
  return "operations";
}

function impactFromOpportunity(oppImpact) {
  const im = OPPORTUNITY_IMPACT_TO_IMPACT[String(oppImpact)] ?? "Medium";
  return im;
}

function effortFromImpact(im) {
  if (im === "Very High" || im === "High") return "Small";
  if (im === "Medium") return "Medium";
  return "Large";
}

function impactFromDecisionPriority(decisionPriority) {
  const p = String(decisionPriority ?? "").toUpperCase();
  if (p === "HIGH") return "High";
  return "Medium";
}

function effortFromRiskPriority(riskPriority) {
  const p = String(riskPriority ?? "").toUpperCase();
  if (p === "HIGH") return "Small";
  if (p === "MEDIUM") return "Medium";
  return "Large";
}

function impactFromRiskPriority(riskPriority) {
  const p = String(riskPriority ?? "").toUpperCase();
  if (p === "HIGH") return "Very High";
  if (p === "MEDIUM") return "High";
  return "Medium";
}

function actionFromCategoryAndSource({ category, source } = {}) {
  // Business action ids (deterministic, not UI commands).
  if (category === "work_queue") return "review_work_queue";
  if (category === "communications") return "review_communications";
  if (category === "connected_systems") return "connect_disconnected_systems";
  if (category === "knowledge") return "publish_knowledge";
  if (category === "digital_workforce") return "deploy_employee";
  if (category === "onboarding") return "complete_onboarding";
  if (category === "business_profile") return "complete_business_profile";
  if (category === "company_profile") return "complete_company_profile";
  if (category === "workspace") return "review_workspace_readiness";
  if (category === "automation") return "automate_approvals";

  // Default.
  return source === "company_brief" ? "review_work_queue" : "review_operational_readiness";
}

function actionFromOpportunityRecommendedAction(recommendedAction) {
  const target = String(recommendedAction?.target ?? "");
  if (target === "work_queue" || target === "queue") return "review_work_queue";
  if (target === "SOP" || target === "knowledge" || target === "knowledge_repository") return "publish_knowledge";
  if (target === "communications") return "review_communications";
  if (target === "digital_workforce") return "deploy_employee";
  if (target === "onboarding") return "complete_onboarding";
  if (target === "business_profile") return "complete_business_profile";
  if (target === "company_profile") return "complete_company_profile";
  if (target === "operational_readiness") return "review_operational_readiness";
  if (target === "approvals") return "review_work_queue";
  if (target === "email") return "connect_email";
  if (target === "crm") return "connect_crm";
  return "review_operational_readiness";
}

function summarizeActionPhrase(rec) {
  // A deterministic, human-friendly phrase for summary composition.
  const action = String(rec.action ?? "");
  const cat = String(rec.category ?? "");
  if (action === "connect_email" || action === "connect_disconnected_systems" || cat === "connected_systems") return "reconnect email first";
  if (action === "review_work_queue" || cat === "work_queue") return "review pending work first";
  if (action === "publish_knowledge" || cat === "knowledge") return "publish knowledge first";
  if (cat === "communications") return "review communications first";
  if (cat === "digital_workforce") return "deploy employees first";
  if (cat === "onboarding") return "complete onboarding first";
  return "take the next highest priority action";
}

function buildSourceRanks() {
  // Lower rank -> earlier in prioritization.
  return {
    company_brief: 0,
    company_health: 1,
    company_insights: 2,
    company_opportunities: 3,
  };
}

function severityRankFromImpact(impact) {
  const im = String(impact ?? "");
  const map = {
    "Very High": 0,
    High: 1,
    Medium: 2,
    Low: 3,
    "Very Low": 4,
  };
  return map[im] ?? 2;
}

function severityRankFromInsightSeverity(sev) {
  const s = String(sev ?? "");
  const lower = s.toLowerCase();
  const map = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return map[lower] ?? 2;
}

export function buildRecommendationCandidates({
  companyBrief,
  companyHealth,
  companyInsights,
  companyOpportunities,
  capabilityEngine,
} = {}) {
  // capabilityEngine is accepted for future deterministic readiness gaps.
  void capabilityEngine;

  const sourceRanks = buildSourceRanks();
  const companyId =
    String(companyBrief?.companyId ?? companyHealth?.companyId ?? companyInsights?.companyId ?? companyOpportunities?.companyId ?? "company");

  const candidates = [];
  const addCandidate = (c) => {
    if (!c || typeof c !== "object") return;
    if (!c.id) return;
    candidates.push(c);
  };

  // 1) CompanyBrief decisions waiting.
  for (const d of safeArray(companyBrief?.decisionsWaiting)) {
    if (!d || typeof d !== "object") continue;
    const id = `rec_${String(d.id ?? "")}`;
    const category = categoryFromDecisionTarget(d.target);
    const impact = impactFromDecisionPriority(d.priority);
    const effort = "Small";
    const action = d.id === "decision_approve_communications" ? "approve_communications" : "review_work_queue";
    const target = String(d.target ?? "");
    const status = "open";

    addCandidate({
      id,
      title: String(d.label ?? d.id ?? "Decision"),
      summary: String(d.label ?? "Pending decision requires attention."),
      category,
      impact,
      effort,
      source: "company_brief",
      reason: `Decision waiting: ${String(d.id ?? "")}`,
      action,
      target,
      dependencies: [],
      status,
      // for prioritization:
      sourcePriorityRank: sourceRanks.company_brief,
      severityRank: severityRankFromImpact(impact),
      metadata: deepFreeze({
        decisionTarget: target,
      }),
    });
  }

  // 2) CompanyHealth risks.
  for (const r of safeArray(companyHealth?.risks)) {
    if (!r || typeof r !== "object") continue;
    const id = `rec_${String(r.id ?? "")}`;
    const category = categoryFromRiskId(r.id);
    const impact = impactFromRiskPriority(r.priority);
    const effort = effortFromRiskPriority(r.priority);
    const action =
      category === "communications" ? "review_communications" : category === "connected_systems" ? "connect_disconnected_systems" : actionFromCategoryAndSource({ category, source: "company_health" });

    addCandidate({
      id,
      title: String(r.label ?? r.id ?? "Risk"),
      summary: String(r.summary ?? r.label ?? "Review risk and address root cause."),
      category,
      impact,
      effort,
      source: "company_health",
      reason: `Risk detected: ${String(r.id ?? "")}`,
      action,
      target: category,
      dependencies: [],
      status: "open",
      sourcePriorityRank: sourceRanks.company_health,
      severityRank: severityRankFromImpact(impact),
      metadata: deepFreeze({ riskPriority: r.priority }),
    });
  }

  // 3) Negative insights.
  for (const i of safeArray(companyInsights?.insights)) {
    if (!i || typeof i !== "object") continue;
    if (i.direction !== "declined" && i.direction !== "new") continue;
    const id = `rec_${String(i.id ?? "")}`;
    const category = categoryFromInsightCategory(i.category);
    const impact = INSIGHT_SEVERITY_TO_IMPACT[String(i.severity)] ?? "Medium";
    const effort = impact === "Very High" || impact === "High" ? "Small" : impact === "Medium" ? "Medium" : "Large";
    const action = actionFromCategoryAndSource({ category, source: "company_insights" });
    addCandidate({
      id,
      title: String(i.title ?? i.id ?? "Insight"),
      summary: String(i.summary ?? "Detected negative change."),
      category,
      impact,
      effort,
      source: "company_insights",
      reason: `Insight indicates negative direction (${String(i.direction ?? "")}).`,
      action,
      target: category,
      dependencies: [],
      status: "open",
      sourcePriorityRank: sourceRanks.company_insights,
      severityRank: severityRankFromInsightSeverity(i.severity),
      metadata: deepFreeze({ insightSeverity: i.severity }),
    });
  }

  // 4) CompanyOpportunities.
  const opps = safeArray(companyOpportunities?.opportunities);
  for (const o of opps) {
    if (!o || typeof o !== "object") continue;
    const id = `rec_${String(o.id ?? "")}`;
    const category = normalizeCategoryFromOpportunityCategory(o.category);
    const impact = impactFromOpportunity(o.impact);
    const effort = String(o.effort ?? effortFromImpact(impact));
    const recommendedAction = o.recommendedAction ?? {};
    const action = actionFromOpportunityRecommendedAction(recommendedAction);
    const target = String(recommendedAction?.target ?? category);

    const deps = safeArray(o.dependencies).map((depOppId) => `rec_${String(depOppId)}`);
    const status = deps.length > 0 ? "blocked" : "open";

    addCandidate({
      id,
      title: String(o.title ?? o.id ?? "Opportunity"),
      summary: String(o.summary ?? "Create deterministic improvement execution plan."),
      category,
      impact,
      effort: RECOMMENDATION_EFFORT.includes(effort) ? effort : effortFromImpact(impact),
      source: "company_opportunities",
      reason: `Opportunity: ${String(o.id ?? "")}`,
      action,
      target,
      dependencies: deps,
      status,
      sourcePriorityRank: sourceRanks.company_opportunities + (o.priority === "IMMEDIATE" ? -1 : 0),
      severityRank: severityRankFromImpact(impact),
      metadata: deepFreeze({ opportunityPriority: o.priority }),
    });
  }

  // De-duplicate by id deterministically (first occurrence wins).
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    if (!c?.id) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push(c);
  }

  // Freeze candidate metadata; rest stays plain until prioritization finishes.
  // (We keep candidates mutable just for prioritization.)

  return { candidates: unique, companyId };
}

export function createCompanyRecommendationFromCandidate(candidate, priorityTier) {
  const {
    id,
    title,
    summary,
    category,
    impact,
    effort,
    source,
    reason,
    action,
    target,
    dependencies,
    status,
    metadata,
  } = candidate;

  if (!RECOMMENDATION_EFFORT.includes(String(effort))) {
    fail(`effort invalid: ${effort}`);
  }
  if (!RECOMMENDATION_IMPACT.includes(String(impact))) {
    fail(`impact invalid: ${impact}`);
  }

  return createCompanyRecommendation({
    id,
    title,
    summary,
    category,
    priority: priorityTier,
    impact,
    effort,
    source,
    reason,
    action,
    target,
    dependencies: safeArray(dependencies),
    status,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  });
}

export function buildCompanySummary({ topRecommendation } = {}) {
  if (!topRecommendation) return "No major action required. Continue monitoring company health.";
  const phrase = summarizeActionPhrase(topRecommendation);
  return `The top priority is ${phrase}.`;
}

