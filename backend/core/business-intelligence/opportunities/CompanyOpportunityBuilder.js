import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_PRIORITY,
  OPPORTUNITY_IMPACT,
  OPPORTUNITY_EFFORT,
  priorityFromSignals,
  impactFromScore,
} from "./CompanyOpportunityDefaults.js";
import { scoreOpportunity, recommendedOrderKey } from "./CompanyOpportunityScorer.js";

import { createCompanyOpportunity } from "./CompanyOpportunity.js";
import { createCompanyOpportunities } from "./CompanyOpportunities.js";

function fail(message) {
  throw new Error(`CompanyOpportunityBuilder: ${message}`);
}

function getHealthDimension(companyHealth, dimId) {
  const dims = Array.isArray(companyHealth?.dimensions) ? companyHealth.dimensions : [];
  return dims.find((d) => d?.id === dimId) ?? null;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function categoryDisplayName(category) {
  return String(category ?? "").replace(/_/g, " ");
}

function buildRecommendedAction({ id, label, type, target, metadata } = {}) {
  return deepFreeze({
    id: String(id ?? ""),
    label: String(label ?? ""),
    type: String(type ?? ""),
    target: String(target ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

function detectDeclinedInsightCategories(companyInsights) {
  const insights = safeArray(companyInsights?.insights);
  const set = new Set();
  for (const i of insights) {
    if (i?.direction !== "declined") continue;
    if (!i?.category) continue;
    const c = String(i.category);
    // Normalize to allowed categories.
    if (OPPORTUNITY_CATEGORIES.includes(c)) set.add(c);
  }
  return set;
}

function deriveSopMissing(knowledgeRepository) {
  const items = safeArray(knowledgeRepository?.items);
  const sopItems = items.filter((i) => i && i.category === "SOP" && i.status !== "ARCHIVED");
  return sopItems.length === 0;
}

function readinessFromCommunicationSetup(communicationSetup) {
  const r = communicationSetup?.readiness ?? {};
  const flags = [
    Boolean(r.emailReady),
    Boolean(r.smsReady),
    Boolean(r.brandReady),
    Boolean(r.quietHoursReady),
    Boolean(r.approvalPolicyReady),
  ];
  const readyCount = flags.filter(Boolean).length;
  const total = flags.length || 1;
  const readyRatio = readyCount / total;
  return { readyCount, total, readyRatio };
}

function businessCompletionSignals(companyRuntime, businessProfile, companyProfile) {
  const bp = businessProfile ?? companyRuntime?.getBusinessProfile?.();
  const cp = companyProfile ?? companyRuntime?.getCompanyProfile?.();
  const bpStatus = bp?.metadata?.completionStatus ?? "";
  const cpStatus = cp?.metadata?.completionStatus ?? "";
  const bpPercent = Number(bp?.metadata?.completionPercent ?? 0);
  const cpPercent = Number(cp?.metadata?.completionPercent ?? 0);
  return { bpStatus, cpStatus, bpPercent, cpPercent };
}

function countDisconnected(connectedSystems) {
  const list = safeArray(connectedSystems);
  const disconnected = list.filter((s) => String(s?.status ?? "") !== "READY").length;
  return { disconnectedCount: disconnected, total: list.length || 1 };
}

function extractPendingReviewsFromBrief(companyBrief) {
  const decisions = safeArray(companyBrief?.decisionsWaiting);
  const d = decisions.find((x) => x?.id === "decision_review_work_queue");
  const pendingReviews = Number(d?.metadata?.pendingReviews ?? 0);
  return pendingReviews;
}

function extractPendingReviewsFromRuntime(companyRuntime) {
  // Use runtime metrics first (deterministic).
  const metrics = companyRuntime?.getMetrics?.() ?? {};
  return Number(metrics.pendingReviews ?? 0);
}

export function buildCompanyOpportunities({
  companyRuntime,
  companyBrief,
  companyHealth,
  companyInsights,
  capabilityEngine,
  knowledgeRepository,
  connectedSystems,
  communicationSetup,
  workQueue,
  employees,
  businessProfile,
  companyProfile,
  activities,
  nowISO,
} = {}) {
  if (!companyRuntime && !companyHealth && !companyBrief) {
    throw new Error("CompanyOpportunityBuilder: no inputs provided.");
  }

  const effectiveNowISO = nowISO ?? "2026-07-01T00:00:00.000Z";
  const companyId = String(companyRuntime?.getCompany?.()?.companyName ?? companyHealth?.companyId ?? companyBrief?.companyId ?? "company");
  const declinedCategories = detectDeclinedInsightCategories(companyInsights);

  const connected = connectedSystems ?? companyRuntime?.getConnectedSystems?.() ?? [];
  const disconnectedInfo = countDisconnected(connected);

  const knowledgeRepo =
    knowledgeRepository ?? companyRuntime?.getKnowledgeRepository?.() ?? { items: [] };
  const sopMissing = deriveSopMissing(knowledgeRepo);

  const commSetup = communicationSetup ?? companyRuntime?.getCommunicationSetup?.() ?? {};
  const commReadiness = readinessFromCommunicationSetup(commSetup);
  const commIncomplete = commReadiness.readyCount !== commReadiness.total;

  const pendingReviews = extractPendingReviewsFromBrief(companyBrief);
  const pendingReviewsFallback = extractPendingReviewsFromRuntime(companyRuntime);
  const pending = pendingReviews || pendingReviewsFallback;

  const queueItems = safeArray(workQueue ?? companyRuntime?.getWorkQueue?.() ?? []);
  const workQueueSize = queueItems.length;

  const employeesList = safeArray(employees ?? companyRuntime?.getEmployees?.() ?? []);
  const offlineCount = employeesList.filter((e) => e?.status === "Offline").length;

  const { bpStatus, cpStatus } = businessCompletionSignals(companyRuntime, businessProfile, companyProfile);
  const onboardingIncomplete = bpStatus !== "COMPLETE" || cpStatus !== "COMPLETE";

  const operationalHealth = getHealthDimension(companyHealth, "operational_readiness");
  const operationalReadinessStatus = operationalHealth?.status ?? "UNKNOWN";

  const opportunities = [];
  const add = (opp) => opportunities.push(opp);

  // Connected systems opportunity.
  if (disconnectedInfo.disconnectedCount > 0) {
    const disconnected = disconnectedInfo.disconnectedCount;
    const impactScore = disconnected >= 2 ? 92 : disconnected === 1 ? 78 : 60;
    const priority = priorityFromSignals({ impact: impactFromScore(impactScore), urgencyScore: disconnected * 30 });
    const scored = scoreOpportunity({ impactScore, impactSize: impactFromScore(impactScore), effortSize: "SMALL", urgency: disconnected * 30, backlogSize: disconnected });

    // Provide recommendedAction as business action.
    // Split into reconnect opportunities for email/crm when provider info exists.
    const disconnectedList = safeArray(connected).filter((s) => String(s?.status ?? "") !== "READY");
    const email = disconnectedList.find((s) => String(s?.provider ?? "") === "email" || String(s?.id ?? "").includes("email"));
    const crm = disconnectedList.find((s) => String(s?.provider ?? "") === "crm" || String(s?.id ?? "").includes("crm"));

    if (email) {
      add(
        createCompanyOpportunity({
          id: "opp_reconnect_email",
          title: "Reconnect Gmail",
          summary: "Restore outbound and governance-safe communication reliability by reconnecting email intake/sender readiness.",
          category: "connected_systems",
          priority,
          impact: impactFromScore(impactScore),
          effort: "Small",
          estimatedValue: "Communication Reliability",
          confidence: 0.85,
          reason: `Email is disconnected (${String(email?.status ?? "")} != READY).`,
          recommendedAction: buildRecommendedAction({
            id: "act_reconnect_email",
            label: "Reconnect Gmail",
            type: "INTEGRATIONS",
            target: "email",
            metadata: { systemId: String(email?.id ?? "") },
          }),
          dependencies: [],
          metadata: deepFreeze({ disconnectedCount: disconnected, provider: "email" }),
        }),
      );
    }

    if (crm) {
      add(
        createCompanyOpportunity({
          id: "opp_connect_crm",
          title: "Connect CRM",
          summary: "Restore CRM intake and operational workflows by connecting the CRM integration.",
          category: "connected_systems",
          priority: priority === "IMMEDIATE" ? "IMMEDIATE" : "SOON",
          impact: impactFromScore(impactScore - 10),
          effort: "Small",
          estimatedValue: "Operational Maturity",
          confidence: 0.8,
          reason: `CRM is disconnected (${String(crm?.status ?? "")} != READY).`,
          recommendedAction: buildRecommendedAction({
            id: "act_connect_crm",
            label: "Connect CRM",
            type: "INTEGRATIONS",
            target: "crm",
            metadata: { systemId: String(crm?.id ?? "") },
          }),
          dependencies: [],
          metadata: deepFreeze({ disconnectedCount: disconnected, provider: "crm" }),
        }),
      );
    }
  }

  // Communication readiness opportunity.
  if (commIncomplete) {
    const impactScore = commReadiness.readyRatio <= 0.6 ? 85 : 65;
    const impact = impactFromScore(impactScore);
    const priority = priorityFromSignals({ impact, urgencyScore: (commReadiness.total - commReadiness.readyCount) * 20 });
    add(
      createCompanyOpportunity({
        id: "opp_improve_communication_readiness",
        title: "Improve Communication Readiness",
        summary: "Reduce governance risk by completing communication readiness signals (email, brand, quiet hours, approval policy).",
        category: "communications",
        priority,
        impact,
        effort: commReadiness.readyCount <= 2 ? "Medium" : "Small",
        estimatedValue: "Communication Reliability",
        confidence: 0.8,
        reason: `Communication readiness is incomplete (${commReadiness.readyCount}/${commReadiness.total} signals ready).`,
        recommendedAction: buildRecommendedAction({
          id: "act_improve_communication_readiness",
          label: "Improve Communication Readiness",
          type: "BUSINESS",
          target: "communications",
          metadata: deepFreeze({ readyCount: commReadiness.readyCount, total: commReadiness.total }),
        }),
        dependencies: [],
        metadata: deepFreeze({ readyCount: commReadiness.readyCount, total: commReadiness.total }),
      }),
    );
  }

  // Knowledge SOP opportunity.
  if (sopMissing) {
    const impactScore = 70;
    const impact = impactFromScore(impactScore);
    add(
      createCompanyOpportunity({
        id: "opp_publish_sop_knowledge",
        title: "Publish SOP Knowledge",
        summary: "Increase governance consistency by publishing missing SOP guidance for repeatable execution.",
        category: "knowledge",
        priority: priorityFromSignals({ impact, urgencyScore: 40 }),
        impact,
        effort: "Medium",
        estimatedValue: "Knowledge Quality",
        confidence: 0.7,
        reason: "No active knowledge items exist in the SOP category.",
        recommendedAction: buildRecommendedAction({
          id: "act_publish_sop",
          label: "Publish SOP Knowledge",
          type: "KNOWLEDGE",
          target: "SOP",
          metadata: {},
        }),
        dependencies: [],
        metadata: deepFreeze({ sopMissing: true }),
      }),
    );
  }

  // Work queue review opportunity.
  if (pending > 0) {
    const impactScore = pending >= 5 ? 92 : pending >= 3 ? 80 : 60;
    const impact = impactFromScore(impactScore);
    add(
      createCompanyOpportunity({
        id: "opp_review_pending_work",
        title: "Review Pending Work",
        summary: "Reduce approval backlog by reviewing and deciding queued buyer response drafts.",
        category: "work_queue",
        priority: priorityFromSignals({ impact, urgencyScore: pending * 15 }),
        impact,
        effort: "Small",
        estimatedValue: "Risk Reduction",
        confidence: 0.85,
        reason: `There are ${pending} pending review item(s).`,
        recommendedAction: buildRecommendedAction({
          id: "act_review_work_queue",
          label: "Review Work Queue",
          type: "GOVERNANCE",
          target: "work_queue",
          metadata: { pendingReviews: pending },
        }),
        dependencies: [],
        metadata: deepFreeze({ pendingReviews: pending }),
      }),
    );

    if (pending >= 3) {
      add(
        createCompanyOpportunity({
          id: "opp_automate_approvals",
          title: "Automate Approvals Where Appropriate",
          summary: "Reduce governance bottlenecks by automating deterministic approval steps within policy boundaries.",
          category: "automation",
          priority: pending >= 6 ? "IMMEDIATE" : "SOON",
          impact: impactFromScore(65),
          effort: "Large",
          estimatedValue: "Time Savings",
          confidence: 0.65,
          reason: `Approval backlog is sizable (${pending} pending).`,
          recommendedAction: buildRecommendedAction({
            id: "act_automate_approvals",
            label: "Automate Approvals Where Appropriate",
            type: "GOVERNANCE",
            target: "approvals",
            metadata: { pendingReviews: pending },
          }),
          dependencies: ["opp_review_pending_work"],
          metadata: deepFreeze({ pendingReviews: pending }),
        }),
      );
    }
  }

  // Digital workforce opportunity.
  if (offlineCount > 0 && employeesList.length > 0) {
    const impactScore = offlineCount >= 2 ? 75 : 60;
    const impact = impactFromScore(impactScore);
    add(
      createCompanyOpportunity({
        id: "opp_deploy_additional_digital_employees",
        title: "Deploy Additional Digital Employees",
        summary: "Increase workforce capacity by addressing offline employees and enabling additional workforce coverage.",
        category: "digital_workforce",
        priority: priorityFromSignals({ impact, urgencyScore: offlineCount * 25 }),
        impact,
        effort: "Medium",
        estimatedValue: "Operational Maturity",
        confidence: 0.7,
        reason: `${offlineCount} employee(s) are currently offline.`,
        recommendedAction: buildRecommendedAction({
          id: "act_deploy_employees",
          label: "Deploy Additional Digital Employees",
          type: "WORKFORCE",
          target: "digital_workforce",
          metadata: { offlineCount },
        }),
        dependencies: [],
        metadata: deepFreeze({ offlineCount }),
      }),
    );
  }

  // Onboarding/profile completion opportunity.
  if (onboardingIncomplete) {
    const impactScore = 70;
    const impact = impactFromScore(impactScore);
    add(
      createCompanyOpportunity({
        id: "opp_complete_onboarding",
        title: "Complete Onboarding",
        summary: "Finalize business and company setup to unlock deterministic governance and operational readiness.",
        category: "onboarding",
        priority: "SOON",
        impact,
        effort: "Medium",
        estimatedValue: "Operational Maturity",
        confidence: 0.75,
        reason: `Onboarding completion status is not COMPLETE (business=${bpStatus || "?"}, company=${cpStatus || "?"}).`,
        recommendedAction: buildRecommendedAction({
          id: "act_complete_onboarding",
          label: "Complete Onboarding",
          type: "BUSINESS",
          target: "onboarding",
          metadata: { businessCompletion: bpStatus, companyCompletion: cpStatus },
        }),
        dependencies: [],
        metadata: deepFreeze({ bpStatus, cpStatus }),
      }),
    );

    if (bpStatus !== "COMPLETE") {
      add(
        createCompanyOpportunity({
          id: "opp_complete_business_profile",
          title: "Complete Business Profile",
          summary: "Complete business setup to ensure governance policies and operating context are accurate.",
          category: "business_profile",
          priority: "SOON",
          impact: impactFromScore(65),
          effort: "Small",
          estimatedValue: "Risk Reduction",
          confidence: 0.7,
          reason: "Business profile completion is not COMPLETE.",
          recommendedAction: buildRecommendedAction({
            id: "act_complete_business_profile",
            label: "Complete Business Profile",
            type: "BUSINESS",
            target: "business_profile",
            metadata: { completionStatus: bpStatus },
          }),
          dependencies: ["opp_complete_onboarding"],
          metadata: deepFreeze({ completionStatus: bpStatus }),
        }),
      );
    }
    if (cpStatus !== "COMPLETE") {
      add(
        createCompanyOpportunity({
          id: "opp_complete_company_profile",
          title: "Complete Company Profile",
          summary: "Complete company setup so communications and governance defaults are deterministic.",
          category: "company_profile",
          priority: "SOON",
          impact: impactFromScore(65),
          effort: "Small",
          estimatedValue: "Communication Reliability",
          confidence: 0.7,
          reason: "Company profile completion is not COMPLETE.",
          recommendedAction: buildRecommendedAction({
            id: "act_complete_company_profile",
            label: "Complete Company Profile",
            type: "BUSINESS",
            target: "company_profile",
            metadata: { completionStatus: cpStatus },
          }),
          dependencies: ["opp_complete_onboarding"],
          metadata: deepFreeze({ completionStatus: cpStatus }),
        }),
      );
    }
  }

  // Operational readiness opportunity.
  if (operationalReadinessStatus && operationalReadinessStatus !== "READY") {
    add(
      createCompanyOpportunity({
        id: "opp_improve_operational_readiness",
        title: "Improve Operational Readiness",
        summary: "Address readiness gaps that reduce deterministic execution quality.",
        category: "operations",
        priority: operationalReadinessStatus === "DEGRADED" ? "SOON" : "LATER",
        impact: impactFromScore(58),
        effort: "Large",
        estimatedValue: "Operational Maturity",
        confidence: 0.6,
        reason: `Operational readiness is ${operationalReadinessStatus}.`,
        recommendedAction: buildRecommendedAction({
          id: "act_review_operational_readiness",
          label: "Review Operational Readiness",
          type: "READINESS",
          target: "operational_readiness",
          metadata: { readiness: operationalReadinessStatus },
        }),
        dependencies: [],
        metadata: deepFreeze({ operationalReadinessStatus }),
      }),
    );
  }

  // Remove duplicates by id, deterministic.
  const seen = new Set();
  const unique = [];
  for (const o of opportunities) {
    if (!o?.id) continue;
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    unique.push(o);
  }

  // Deterministic ordering and classification.
  unique.sort((a, b) => recommendedOrderKey(a) - recommendedOrderKey(b) || a.id.localeCompare(b.id));

  const quickWins = unique.filter((o) => {
    const effortOk = o.effort === "Small";
    const impactOk = o.impact === "High" || o.impact === "Very High";
    return effortOk && impactOk;
  });
  const strategicInvestments = unique.filter((o) => !quickWins.some((q) => q.id === o.id));

  const maxImpact = unique.reduce((acc, o) => {
    if (!acc) return o.impact;
    const order = { "Very High": 4, High: 3, Medium: 2, Low: 1, "Very Low": 0 };
    return order[o.impact] > order[acc] ? o.impact : acc;
  }, null);

  const overallPotential = maxImpact === "Very High" || maxImpact === "High" ? "High" : maxImpact === "Medium" ? "Medium" : "Low";

  const immediateCount = unique.filter((o) => o.priority === "IMMEDIATE").length;
  const best = unique[0] ?? null;
  const summary = best
    ? `${categoryDisplayName(best.category)} is the greatest opportunity. ${immediateCount} opportunity item(s) are immediate.`
    : "No deterministic opportunities detected.";

  const opportunitiesId = `opps_${companyId}_${effectiveNowISO}`;

  return createCompanyOpportunities({
    opportunitiesId,
    companyId,
    generatedAt: effectiveNowISO,
    summary,
    overallPotential,
    opportunities: unique,
    quickWins,
    strategicInvestments,
    recommendedOrder: unique.map((o) => o.id),
    metadata: deepFreeze({ derivedFrom: { health: Boolean(companyHealth), brief: Boolean(companyBrief) }, declinedCategories: Array.from(declinedCategories) }),
  });
}

