import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { createMissionControl } from "./MissionControl.js";
import { createMissionControlAction } from "./MissionControlAction.js";
import { createMissionControlCard } from "./MissionControlCard.js";
import { createMissionControlSection } from "./MissionControlSection.js";

import {
  CARD_SOURCES,
  DEFAULT_SECTION_ORDER,
  MISSION_CONTROL_STATUS,
  PRIMARY_FOCUS,
  PRIORITY_TIER_RANK,
} from "./MissionControlDefaults.js";

const SECTION_IDS = {
  company_brief: "section_company_brief",
  company_health: "section_company_health",
  recommendations: "section_recommendations",
  decisions_waiting: "section_decisions_waiting",
  risks: "section_risks",
  opportunities: "section_opportunities",
  digital_workforce: "section_digital_workforce",
  recent_activity: "section_recent_activity",
  connected_systems: "section_connected_systems",
  knowledge: "section_knowledge",
  work_queue: "section_work_queue",
};

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function parseCompanyId(...objs) {
  for (const o of objs) {
    const id = o?.companyId ?? o?.company_id ?? o?.company?.companyId;
    if (typeof id === "string" && id.length) return id;
  }
  return "company";
}

function priorityTierFromRank(rank) {
  if (rank <= 0) return "immediate";
  if (rank === 1) return "soon";
  return "later";
}

function sectionPriorityFromPrimaryFocus(primaryFocus) {
  // Owner sees primary focus first; still keep deterministic order for the rest.
  const ranksBySection = {
    [SECTION_IDS.company_brief]: 1,
    [SECTION_IDS.company_health]: 2,
    [SECTION_IDS.recommendations]: 0,
    [SECTION_IDS.decisions_waiting]: 0,
    [SECTION_IDS.risks]: 0,
    [SECTION_IDS.opportunities]: 2,
    [SECTION_IDS.digital_workforce]: 2,
    [SECTION_IDS.recent_activity]: 2,
    [SECTION_IDS.connected_systems]: 2,
    [SECTION_IDS.knowledge]: 2,
    [SECTION_IDS.work_queue]: 1,
  };

  const focusToSection = {
    review_decisions: [SECTION_IDS.decisions_waiting, SECTION_IDS.work_queue],
    resolve_risks: [SECTION_IDS.risks],
    improve_health: [SECTION_IDS.company_health],
    complete_setup: [SECTION_IDS.company_brief, SECTION_IDS.knowledge, SECTION_IDS.connected_systems],
    monitor_business: [SECTION_IDS.company_health, SECTION_IDS.recent_activity],
    act_on_recommendation: [SECTION_IDS.recommendations],
  };

  const immediateSections = new Set(focusToSection[primaryFocus] ?? []);
  for (const sid of immediateSections) ranksBySection[sid] = 0;

  return ranksBySection;
}

function computeHeadlineAndStatus({ companyBrief, companyHealth, decisionsWaitingCount, highRiskCount, setupRequired }) {
  const healthOverall = String(companyHealth?.overallStatus ?? "");

  let overallStatus = MISSION_CONTROL_STATUS.healthy;
  if (setupRequired) overallStatus = MISSION_CONTROL_STATUS.setup_required;
  else if (healthOverall === "CRITICAL" || highRiskCount > 0) overallStatus = MISSION_CONTROL_STATUS.critical;
  else if (healthOverall === "FAIR" || healthOverall === "POOR" || String(companyBrief?.overallStatus ?? "") === "NEEDS_ATTENTION") {
    overallStatus = MISSION_CONTROL_STATUS.needs_attention;
  } else if (healthOverall === "EXCELLENT") {
    overallStatus = MISSION_CONTROL_STATUS.excellent;
  }

  let headline = "Good morning.";
  if (overallStatus === MISSION_CONTROL_STATUS.excellent) headline = "Good morning. Your business is excellent across the board.";
  if (overallStatus === MISSION_CONTROL_STATUS.healthy) {
    headline = `Good morning. Your business is healthy, with ${decisionsWaitingCount} decision(s) waiting.`;
  }
  if (overallStatus === MISSION_CONTROL_STATUS.needs_attention) {
    headline = "Your business needs attention. Review decisions and resolve key risks.";
  }
  if (overallStatus === MISSION_CONTROL_STATUS.critical) {
    headline = "Your business needs critical attention. Focus on the highest-risk remediation items first.";
  }
  if (overallStatus === MISSION_CONTROL_STATUS.setup_required) {
    headline = "Your business setup needs attention. Complete required setup to unlock reliable operations.";
  }

  return { headline, overallStatus };
}

function computePrimaryFocus({ companyBrief, companyHealth, decisionsWaitingCount, highRiskCount, setupRequired, topRecommendation } = {}) {
  if (setupRequired) return "complete_setup";
  if (decisionsWaitingCount > 0) return "review_decisions";
  if (highRiskCount > 0) return "resolve_risks";

  const healthOverall = String(companyHealth?.overallStatus ?? "");
  if (healthOverall === "CRITICAL" || healthOverall === "POOR" || healthOverall === "FAIR") return "improve_health";

  if (topRecommendation && topRecommendation.status === "open") return "act_on_recommendation";
  return "monitor_business";
}

function riskPriorityRank(risk) {
  const p = String(risk?.priority ?? "");
  if (p === "HIGH") return 0;
  if (p === "MEDIUM") return 1;
  return 2;
}

function riskActionFromRiskId(riskId) {
  const id = String(riskId ?? "");
  if (id === "risk_communication_failures") return "review_communications";
  if (id === "risk_disconnected_systems") return "connect_disconnected_systems";
  if (id === "risk_knowledge_publish_ingestion_failures" || id === "risk_empty_knowledge") return "publish_knowledge";
  if (id === "risk_approval_backlog") return "review_work_queue";
  if (id === "risk_blocked_capabilities") return "automate_approvals";
  if (id === "risk_missing_profile_business_setup") return "complete_business_profile";
  return "review_work_queue";
}

function actionForSectionFromCategory({ category } = {}) {
  if (category === "knowledge") return "publish_knowledge";
  if (category === "communications") return "review_communications";
  if (category === "connected_systems") return "connect_disconnected_systems";
  if (category === "digital_workforce") return "deploy_employee";
  if (category === "work_queue") return "review_work_queue";
  return "review_operational_readiness";
}

function mapRecommendationToMissionAction(recommendation) {
  return createMissionControlAction({
    id: String(recommendation.action),
    action: String(recommendation.action),
    label: String(recommendation.title),
    target: String(recommendation.target),
    dependencies: Array.isArray(recommendation.dependencies) ? recommendation.dependencies : [],
    status: String(recommendation.status ?? "open"),
    metadata: deepFreeze({ source: recommendation.source }),
  });
}

function mapRecommendationToCard(rec) {
  return createMissionControlCard({
    id: "card_top_recommendation",
    title: "Recommendation",
    subtitle: rec.title,
    summary: rec.summary,
    status: rec.status,
    priority: rec.priority,
    metric: null,
    trend: null,
    actions: [String(rec.action)],
    source: "company_recommendations",
    metadata: deepFreeze({ category: rec.category, impact: rec.impact, effort: rec.effort }),
  });
}

function metricTrendFromHealthDim(dim) {
  const metric = typeof dim?.score === "number" ? dim.score : null;
  const trend = dim?.trend ? String(dim.trend) : null;
  return { metric, trend };
}

function findDimension(health, dimId) {
  return safeArray(health?.dimensions).find((d) => d?.id === dimId) ?? null;
}

export function buildMissionControl({
  companyBrief,
  companyHealth,
  companyInsights,
  companyOpportunities,
  companyRecommendations,
  workspaceConfigViewModel,
  workspaceConfig,
  companyRuntime,
  capabilityEngine,
  nowISO,
} = {}) {
  void companyInsights;
  void workspaceConfigViewModel;
  void workspaceConfig;
  void companyRuntime;
  void capabilityEngine;

  const companyId = parseCompanyId(companyBrief, companyHealth, companyRecommendations, companyOpportunities);
  const generatedAt = nowISO ?? "2026-07-01T00:00:00.000Z";

  const decisionsWaitingCount = safeArray(companyBrief?.decisionsWaiting).length;
  const highRiskList = safeArray(companyBrief?.risks).filter((r) => String(r?.priority ?? "") === "HIGH");
  const highRiskCount = highRiskList.length;

  const setupRequired = safeArray(companyBrief?.risks).some((r) => String(r?.id ?? "") === "risk_missing_profile_business_setup");

  const topRecommendation = companyRecommendations?.topRecommendation ?? null;

  const { headline, overallStatus } = computeHeadlineAndStatus({
    companyBrief,
    companyHealth,
    decisionsWaitingCount,
    highRiskCount,
    setupRequired,
  });

  const primaryFocus = computePrimaryFocus({
    companyBrief,
    companyHealth,
    decisionsWaitingCount,
    highRiskCount,
    setupRequired,
    topRecommendation,
  });

  // Build actions from recommendations (and any risk/section actions we need).
  const allRecs = safeArray(companyRecommendations?.recommendations);
  const recActions = allRecs.map((r) => mapRecommendationToMissionAction(r));
  const actionById = new Map();
  for (const a of recActions) actionById.set(String(a.id), a);

  const ensureAction = (actionId, { label, target, dependencies, status, metadata } = {}) => {
    const id = String(actionId);
    if (actionById.has(id)) return actionById.get(id);
    const action = createMissionControlAction({
      id,
      action: id,
      label: String(label ?? id),
      target: String(target ?? "company"),
      dependencies: Array.isArray(dependencies) ? dependencies : [],
      status: status ? String(status) : "open",
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    actionById.set(id, action);
    return action;
  };

  // Decisions waiting actions.
  const decisionsWaiting = safeArray(companyBrief?.decisionsWaiting);
  for (const d of decisionsWaiting) {
    const t = String(d?.target ?? "");
    if (t === "work_queue") ensureAction("review_work_queue", { label: "Review Pending Work", target: t });
    if (t === "communications") ensureAction("approve_communications", { label: "Approve Communications", target: t });
  }

  // Risks actions.
  for (const r of safeArray(companyBrief?.risks)) {
    const actionId = riskActionFromRiskId(r?.id);
    ensureAction(actionId, { label: String(r?.label ?? actionId), target: String(r?.id ?? actionId) });
  }

  // Section baseline actions (deterministic).
  ensureAction("deploy_employee", { label: "Deploy Employee", target: "digital_workforce" });
  ensureAction("publish_knowledge", { label: "Publish Knowledge", target: "SOP" });
  ensureAction("connect_disconnected_systems", { label: "Connect Disconnected Systems", target: "connected_systems" });
  ensureAction("review_work_queue", { label: "Review Work Queue", target: "work_queue" });
  ensureAction("review_operational_readiness", { label: "Review Operational Readiness", target: "operational_readiness" });
  ensureAction("connect_email", { label: "Connect Email", target: "email" });
  ensureAction("connect_crm", { label: "Connect CRM", target: "crm" });
  ensureAction("review_communications", { label: "Review Communications", target: "communications" });
  ensureAction("approve_communications", { label: "Approve Communications", target: "communications" });
  ensureAction("complete_onboarding", { label: "Complete Onboarding", target: "onboarding" });
  ensureAction("complete_business_profile", { label: "Complete Business Profile", target: "business_profile" });
  ensureAction("complete_company_profile", { label: "Complete Company Profile", target: "company_profile" });
  ensureAction("automate_approvals", { label: "Automate Approvals", target: "approvals" });

  const actions = Array.from(actionById.values());

  const cards = [];
  const sections = [];

  const sectionRanks = sectionPriorityFromPrimaryFocus(primaryFocus);
  const sectionOrder = [
    SECTION_IDS.company_brief,
    SECTION_IDS.company_health,
    SECTION_IDS.recommendations,
    SECTION_IDS.decisions_waiting,
    SECTION_IDS.risks,
    SECTION_IDS.opportunities,
    SECTION_IDS.digital_workforce,
    SECTION_IDS.recent_activity,
    SECTION_IDS.connected_systems,
    SECTION_IDS.knowledge,
    SECTION_IDS.work_queue,
  ];

  const sectionById = new Map();
  const addSection = (id, opts) => {
    const section = createMissionControlSection({
      id,
      title: opts.title,
      summary: opts.summary,
      priority: opts.priority,
      status: opts.status,
      cards: opts.cards,
      actions: opts.actions,
      metadata: opts.metadata,
    });
    sectionById.set(id, section);
    sections.push(section);
  };

  const priorityTier = (rank) => priorityTierFromRank(rank);

  // Company Health card.
  const companyBriefCard = createMissionControlCard({
    id: "card_company_brief",
    title: "Company Brief",
    subtitle: String(companyBrief?.greeting ?? ""),
    summary: String(companyBrief?.summary ?? ""),
    status: overallStatus === "setup_required" ? "open" : companyBrief?.overallStatus ?? "",
    priority: setupRequired ? "immediate" : overallStatus === "needs_attention" ? "soon" : "later",
    metric: null,
    trend: null,
    actions: [],
    source: "company_brief",
    metadata: deepFreeze({ companyBriefId: companyBrief?.briefId }),
  });
  const overallTrend = String(companyHealth?.overallTrend ?? "UNKNOWN");
  const overallScore = typeof companyHealth?.overallScore === "number" ? companyHealth.overallScore : null;
  const healthCard = createMissionControlCard({
    id: "card_company_health",
    title: "Company Health",
    subtitle: companyHealth?.overallStatus ?? "",
    summary: companyHealth?.summary ?? "",
    status: overallStatus,
    priority: overallStatus === "critical" ? "immediate" : overallStatus === "needs_attention" ? "soon" : "later",
    metric: overallScore,
    trend: overallTrend,
    actions: topRecommendation ? [String(topRecommendation.action)] : [],
    source: "company_health",
    metadata: deepFreeze({ overallScore, overallTrend }),
  });
  cards.push(companyBriefCard);
  cards.push(healthCard);

  // Top Recommendation card.
  const topRecCard = topRecommendation
    ? mapRecommendationToCard(topRecommendation)
    : createMissionControlCard({
        id: "card_top_recommendation",
        title: "Top Recommendation",
        subtitle: "None",
        summary: "No immediate recommendation available.",
        status: "not_applicable",
        priority: "later",
        metric: null,
        trend: null,
        actions: [],
        source: "company_recommendations",
        metadata: deepFreeze({}),
      });
  cards.push(topRecCard);

  // Decisions waiting card.
  const decisionsCard = createMissionControlCard({
    id: "card_decisions_waiting",
    title: "Decisions Waiting",
    subtitle: `${decisionsWaitingCount} decision(s) waiting`,
    summary:
      decisionsWaitingCount > 0
        ? "Review and decide on queued work to keep operations unblocked."
        : "No pending decisions detected.",
    status: decisionsWaitingCount > 0 ? "open" : "not_applicable",
    priority: decisionsWaitingCount > 0 ? "immediate" : "later",
    metric: decisionsWaitingCount,
    trend: null,
    actions: decisionsWaiting.map((d) => {
      const t = String(d?.target ?? "");
      if (t === "work_queue") return "review_work_queue";
      if (t === "communications") return "approve_communications";
      return "review_work_queue";
    }),
    source: "company_brief",
    metadata: deepFreeze({ decisionsWaitingTargets: decisionsWaiting.map((d) => d?.target).map(String) }),
  });
  cards.push(decisionsCard);

  // Risk cards: highest priority first.
  const risksOrdered = safeArray(companyBrief?.risks)
    .slice()
    .sort((a, b) => riskPriorityRank(a) - riskPriorityRank(b) || String(a?.id ?? "").localeCompare(String(b?.id ?? "")))
    .slice(0, 3);

  const riskCards = risksOrdered.map((r, idx) =>
    createMissionControlCard({
      id: `card_risk_${String(r?.id ?? idx)}`,
      title: "Risk",
      subtitle: String(r?.label ?? r?.id ?? `risk_${idx}`),
      summary: String(r?.summary ?? ""),
      status: r?.status ?? "ACTIVE",
      priority: String(r?.priority ?? "") === "HIGH" ? "immediate" : String(r?.priority ?? "") === "MEDIUM" ? "soon" : "later",
      metric: null,
      trend: null,
      actions: [riskActionFromRiskId(r?.id)],
      source: "company_brief",
      metadata: deepFreeze({ riskId: r?.id, riskPriority: r?.priority }),
    }),
  );
  for (const rc of riskCards) cards.push(rc);

  // Opportunities cards from CompanyOpportunities landscape.
  const opps = safeArray(companyOpportunities?.opportunities);
  const oppsOrdered = opps
    .slice()
    .sort((a, b) => {
      const tier = (p) => (String(p).toUpperCase() === "IMMEDIATE" ? 0 : String(p).toUpperCase() === "SOON" ? 1 : 2);
      return tier(a?.priority) - tier(b?.priority) || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
    })
    .slice(0, 2);

  const opportunityCards = oppsOrdered.map((o, idx) =>
    createMissionControlCard({
      id: `card_opportunity_${String(o?.id ?? idx)}`,
      title: "Opportunity",
      subtitle: String(o?.title ?? o?.id ?? `op_${idx}`),
      summary: String(o?.summary ?? ""),
      status: "open",
      priority: String(o?.priority ?? "LATER").toUpperCase() === "IMMEDIATE" ? "immediate" : String(o?.priority ?? "LATER").toUpperCase() === "SOON" ? "soon" : "later",
      metric: null,
      trend: null,
      actions: (() => {
        const deps = safeArray(o?.dependencies);
        // Opportunity actions are represented by the recommendedAction target/category.
        // We include the best-matching mission action id from the action model.
        const target = String(o?.recommendedAction?.target ?? "");
        if (target === "approvals") return ["automate_approvals"];
        if (target === "work_queue") return ["review_work_queue"];
        if (target === "communications") return ["review_communications"];
        if (target === "SOP") return ["publish_knowledge"];
        if (target === "digital_workforce") return ["deploy_employee"];
        if (target === "onboarding") return ["complete_onboarding"];
        if (target === "business_profile") return ["complete_business_profile"];
        if (target === "company_profile") return ["complete_company_profile"];
        if (target === "operational_readiness") return ["review_operational_readiness"];
        if (target === "email") return ["connect_email"];
        if (target === "crm") return ["connect_crm"];
        if (deps.length > 0) return [];
        return ["review_work_queue"];
      })(),
      source: "company_opportunities",
      metadata: deepFreeze({ opportunityId: o?.id, impact: o?.impact, effort: o?.effort }),
    }),
  );
  for (const oc of opportunityCards) cards.push(oc);

  // Digital workforce card.
  const workforceDim = findDimension(companyHealth, "digital_workforce_health");
  const workforce = metricTrendFromHealthDim(workforceDim);
  const workforceCard = createMissionControlCard({
    id: "card_digital_workforce",
    title: "Digital Workforce",
    subtitle: workforceDim?.status ?? "",
    summary: workforceDim?.summary ?? "",
    status: overallStatus,
    priority: workforceDim?.status === "CRITICAL" ? "immediate" : workforceDim?.status === "POOR" ? "soon" : "later",
    metric: workforce.metric,
    trend: workforce.trend,
    actions: ["deploy_employee"],
    source: "company_health",
    metadata: deepFreeze({ dimId: workforceDim?.id }),
  });
  cards.push(workforceCard);

  // Knowledge card.
  const knowledgeDim = findDimension(companyHealth, "knowledge_health");
  const knowledge = metricTrendFromHealthDim(knowledgeDim);
  const knowledgeCard = createMissionControlCard({
    id: "card_knowledge",
    title: "Knowledge",
    subtitle: knowledgeDim?.status ?? "",
    summary: knowledgeDim?.summary ?? "",
    status: overallStatus,
    priority: knowledgeDim?.status === "CRITICAL" ? "immediate" : knowledgeDim?.status === "POOR" ? "soon" : "later",
    metric: knowledge.metric,
    trend: knowledge.trend,
    actions: ["publish_knowledge"],
    source: "company_health",
    metadata: deepFreeze({ dimId: knowledgeDim?.id }),
  });
  cards.push(knowledgeCard);

  // Connected systems card.
  const connectedDim = findDimension(companyHealth, "connected_systems_health");
  const connected = metricTrendFromHealthDim(connectedDim);
  const connectedCard = createMissionControlCard({
    id: "card_connected_systems",
    title: "Connected Systems",
    subtitle: connectedDim?.status ?? "",
    summary: connectedDim?.summary ?? "",
    status: overallStatus,
    priority: connectedDim?.status === "CRITICAL" ? "immediate" : connectedDim?.status === "POOR" ? "soon" : "later",
    metric: connected.metric,
    trend: connected.trend,
    actions: ["connect_disconnected_systems"],
    source: "company_health",
    metadata: deepFreeze({ dimId: connectedDim?.id }),
  });
  cards.push(connectedCard);

  // Recent activity card: use companyBrief.activitySummary metadata if present.
  const recentSummary = companyBrief?.activitySummary?.text ?? companyBrief?.activitySummary?.summary ?? "";
  const recentCard = createMissionControlCard({
    id: "card_recent_activity",
    title: "Recent Activity",
    subtitle: "Latest operational signals",
    summary: recentSummary || "Review recent operational activity to maintain momentum.",
    status: "open",
    priority: "later",
    metric: null,
    trend: null,
    actions: ["review_work_queue"],
    source: "company_brief",
    metadata: deepFreeze({}),
  });
  cards.push(recentCard);

  // Work queue card: derive from decisionsWaiting metadata.
  const workQueueDecision = decisionsWaiting.find((d) => d?.id === "decision_review_work_queue") ?? null;
  const pending = Number(workQueueDecision?.metadata?.pendingReviews ?? 0);
  const workQueueCard = createMissionControlCard({
    id: "card_work_queue",
    title: "Work Queue",
    subtitle: `${pending} item(s) pending review`,
    summary: pending > 0 ? "Unblock operations by deciding on queued items." : "No work queue items pending review.",
    status: pending > 0 ? "open" : "not_applicable",
    priority: pending > 0 ? "immediate" : "later",
    metric: pending,
    trend: null,
    actions: ["review_work_queue"],
    source: "company_brief",
    metadata: deepFreeze({ pendingReviews: pending }),
  });
  cards.push(workQueueCard);

  // Create sections with deterministic card assignments.
  const mkSection = (id, title, summary, priorityRank, cardsForSection, actionsForSection, status) => {
    const tier = priorityTier(priorityRank);
    addSection(id, {
      title,
      summary,
      priority: tier,
      status: status ?? "open",
      cards: cardsForSection,
      actions: actionsForSection.map((a) => String(a)),
      metadata: deepFreeze({}),
    });
  };

  mkSection(
    SECTION_IDS.company_brief,
    "Company Brief",
    String(companyBrief?.summary ?? ""),
    sectionRanks[SECTION_IDS.company_brief] ?? 1,
    [companyBriefCard],
    ["review_work_queue"],
  );

  // Company health
  mkSection(
    SECTION_IDS.company_health,
    "Company Health",
    String(companyHealth?.summary ?? ""),
    sectionRanks[SECTION_IDS.company_health] ?? 2,
    [healthCard],
    [topRecommendation ? String(topRecommendation.action) : "review_operational_readiness"],
  );

  // Recommendations
  mkSection(
    SECTION_IDS.recommendations,
    "Recommendations",
    String(companyRecommendations?.summary ?? ""),
    sectionRanks[SECTION_IDS.recommendations] ?? 2,
    [topRecCard],
    topRecommendation ? [String(topRecommendation.action)] : [],
  );

  // Decisions waiting
  mkSection(
    SECTION_IDS.decisions_waiting,
    "Decisions Waiting",
    decisionsWaitingCount > 0 ? "Decide how to handle queued work." : "No pending decisions detected.",
    sectionRanks[SECTION_IDS.decisions_waiting] ?? 2,
    [decisionsCard],
    decisionsCard.actions,
  );

  // Risks
  mkSection(
    SECTION_IDS.risks,
    "Risks",
    highRiskCount > 0 ? "Highest risks first." : "No high-priority risks detected.",
    sectionRanks[SECTION_IDS.risks] ?? 2,
    riskCards,
    riskCards.flatMap((rc) => rc.actions),
  );

  // Opportunities
  mkSection(
    SECTION_IDS.opportunities,
    "Opportunities",
    String(companyOpportunities?.summary ?? ""),
    sectionRanks[SECTION_IDS.opportunities] ?? 2,
    opportunityCards,
    opportunityCards.flatMap((oc) => oc.actions),
  );

  // Digital workforce
  mkSection(
    SECTION_IDS.digital_workforce,
    "Digital Workforce",
    workforceDim?.summary ?? "",
    sectionRanks[SECTION_IDS.digital_workforce] ?? 2,
    [workforceCard],
    ["deploy_employee"],
  );

  // Recent activity
  mkSection(
    SECTION_IDS.recent_activity,
    "Recent Activity",
    recentCard.summary,
    sectionRanks[SECTION_IDS.recent_activity] ?? 2,
    [recentCard],
    ["review_work_queue"],
  );

  // Connected systems
  mkSection(
    SECTION_IDS.connected_systems,
    "Connected Systems",
    connectedDim?.summary ?? "",
    sectionRanks[SECTION_IDS.connected_systems] ?? 2,
    [connectedCard],
    ["connect_disconnected_systems"],
  );

  // Knowledge
  mkSection(
    SECTION_IDS.knowledge,
    "Knowledge",
    knowledgeDim?.summary ?? "",
    sectionRanks[SECTION_IDS.knowledge] ?? 2,
    [knowledgeCard],
    ["publish_knowledge"],
  );

  // Work queue
  mkSection(
    SECTION_IDS.work_queue,
    "Work Queue",
    pending > 0 ? "Items pending review." : "No pending work queue items.",
    sectionRanks[SECTION_IDS.work_queue] ?? 1,
    [workQueueCard],
    ["review_work_queue"],
  );

  // Sort sections by priority tier then by fixed order.
  const priorityRankForSection = (sid) => PRIORITY_TIER_RANK[sectionById.get(sid)?.priority ?? "later"] ?? 2;
  const sectionIndex = (sid) => sectionOrder.indexOf(sid);
  sections.sort((a, b) => {
    const ra = PRIORITY_TIER_RANK[String(a.priority)] ?? 2;
    const rb = PRIORITY_TIER_RANK[String(b.priority)] ?? 2;
    if (ra !== rb) return ra - rb;
    return sectionIndex(String(a.id)) - sectionIndex(String(b.id));
  });

  const allCards = cards.map((c) => c);
  const allActions = actions.map((a) => a);

  // Alerts
  const alerts = [];
  if (setupRequired) {
    alerts.push(
      deepFreeze({
        id: "alert_setup_required",
        title: "Setup required",
        summary: "Complete required business setup before decisions can safely proceed.",
        status: "open",
        priority: "immediate",
        metadata: deepFreeze({}),
      }),
    );
  }
  for (const r of highRiskList.slice(0, 2)) {
    alerts.push(
      deepFreeze({
        id: `alert_high_risk_${String(r?.id ?? "")}`,
        title: "High priority risk",
        summary: String(r?.summary ?? ""),
        status: "open",
        priority: "immediate",
        metadata: deepFreeze({ riskId: r?.id, riskPriority: r?.priority }),
      }),
    );
  }
  if (topRecommendation && topRecommendation.status === "blocked") {
    alerts.push(
      deepFreeze({
        id: "alert_top_recommendation_blocked",
        title: "Top recommendation is blocked",
        summary: "Review dependencies first to unblock the recommended action.",
        status: "open",
        priority: "soon",
        metadata: deepFreeze({ recommendationId: topRecommendation.id }),
      }),
    );
  }

  const missionControlId = `mc_${companyId}_${generatedAt}`;

  const missionControl = createMissionControl({
    missionControlId,
    companyId,
    generatedAt,
    headline,
    summary: String(companyRecommendations?.summary ?? companyBrief?.summary ?? ""),
    overallStatus,
    primaryFocus,
    sections,
    cards: allCards,
    actions: allActions,
    alerts,
    metadata: deepFreeze({
      derivedFrom: {
        brief: Boolean(companyBrief),
        health: Boolean(companyHealth),
        insights: Boolean(companyInsights),
        opportunities: Boolean(companyOpportunities),
        recommendations: Boolean(companyRecommendations),
      },
    }),
  });

  return missionControl;
}

