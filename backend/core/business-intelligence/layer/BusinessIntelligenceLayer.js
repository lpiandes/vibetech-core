import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CompanyBriefEngine } from "../company-brief/CompanyBriefEngine.js";
import { CompanyHealthEngine } from "../company-health/CompanyHealthEngine.js";
import { CompanyInsightEngine } from "../insights/CompanyInsightEngine.js";
import { CompanyOpportunityEngine } from "../opportunities/CompanyOpportunityEngine.js";
import { CompanyRecommendationEngine } from "../recommendations/CompanyRecommendationEngine.js";
import {
  createGovernedRecommendation,
  validateGovernedRecommendation,
  GOVERNANCE_PIPELINE,
} from "./GovernedRecommendation.js";
import { ReuseResolutionService } from "./ReuseResolutionService.js";
import { analyzeDeterministicObservations } from "./DeterministicObservationAnalyzers.js";

/**
 * Business Intelligence Layer — continuous understanding after install.
 *
 * Composes existing BI engines. Does not replace them.
 * Never mutates Business OS state. Recommendations are governed proposals only.
 *
 * Observe → Analyze → Recommend → Explain → Preview → Dry Run → Approve → Install
 */
export class BusinessIntelligenceLayer {
  constructor({
    nowISO = null,
    briefEngine = null,
    healthEngine = null,
    insightEngine = null,
    opportunityEngine = null,
    recommendationEngine = null,
    reuseResolver = new ReuseResolutionService(),
  } = {}) {
    this.nowISO = nowISO;
    this.briefEngine = briefEngine ?? new CompanyBriefEngine({ nowISO });
    this.healthEngine = healthEngine ?? new CompanyHealthEngine({ nowISO });
    this.insightEngine = insightEngine ?? new CompanyInsightEngine({ nowISO });
    this.opportunityEngine = opportunityEngine ?? new CompanyOpportunityEngine({ nowISO });
    this.recommendationEngine = recommendationEngine ?? new CompanyRecommendationEngine({ nowISO });
    this.reuseResolver = reuseResolver;
  }

  /**
   * Full continuous intelligence pass — read-only.
   */
  observeAndRecommend({
    companyRuntime,
    previousCompanyHealth = null,
    installation = null,
    analytics = null,
    workRuntime = null,
    requestRuntime = null,
    businessSummary = {},
    recentImprovements = [],
  } = {}) {
    if (!companyRuntime) {
      throw new Error("BusinessIntelligenceLayer: companyRuntime required.");
    }

    const observed = this.observe({ companyRuntime, previousCompanyHealth });
    const analyzed = this.analyze({
      ...observed,
      installation,
      analytics,
      workRuntime,
      requestRuntime,
      businessSummary,
    });
    const recommendations = this.recommend({
      findings: analyzed.findings,
      companyRecommendations: observed.companyRecommendations,
      businessSummary,
    });

    const workspace = createBusinessIntelligenceWorkspace({
      companyId: String(
        companyRuntime.getCompanyProfile?.()?.companyId
        ?? companyRuntime.companyId
        ?? businessSummary.businessId
        ?? "company",
      ),
      generatedAt: this.nowISO ?? observed.companyBrief?.generatedAt ?? new Date().toISOString(),
      executiveBriefing: buildExecutiveBriefing(observed, analyzed, recommendations),
      recommendations,
      opportunities: recommendations.filter((entry) => entry.category === "opportunity"),
      businessHealth: summarizeHealth(observed.companyHealth),
      risks: recommendations.filter((entry) => entry.category === "risk" || entry.risk === "high"),
      capacity: recommendations.filter((entry) => entry.category === "capacity"),
      aiSuggestions: recommendations.filter((entry) => entry.category === "ai_suggestion" || entry.reuse?.strategy === "existing_employee_archetype"),
      recentImprovements: Object.freeze([...(recentImprovements ?? [])].map(normalizeImprovement)),
      futureRoadmap: buildRoadmap(recommendations),
      changes: analyzed.findings.filter((entry) => entry.category === "change"),
      improving: deriveTrendItems(observed.companyHealth, "improving"),
      worsening: deriveTrendItems(observed.companyHealth, "worsening"),
      pipeline: GOVERNANCE_PIPELINE,
      mutatesBusinessOs: false,
      observationCounts: analyzed.counts,
    });

    return workspace;
  }

  observe({ companyRuntime, previousCompanyHealth = null } = {}) {
    const companyBrief = this.briefEngine.generate({ companyRuntime });
    const companyHealth = this.healthEngine.generate({ companyRuntime, companyBrief });
    const companyInsights = this.insightEngine.generate({
      previousCompanyHealth: previousCompanyHealth ?? companyHealth,
      currentCompanyHealth: companyHealth,
    });
    const companyOpportunities = this.opportunityEngine.generate({
      companyRuntime,
      companyBrief,
      companyHealth,
      companyInsights,
    });
    const companyRecommendations = this.recommendationEngine.generate({
      companyBrief,
      companyHealth,
      companyInsights,
      companyOpportunities,
    });

    return deepFreeze({
      companyBrief,
      companyHealth,
      companyInsights,
      companyOpportunities,
      companyRecommendations,
    });
  }

  analyze({
    companyRuntime = null,
    companyBrief = null,
    companyHealth = null,
    companyInsights = null,
    companyOpportunities = null,
    installation = null,
    analytics = null,
    workRuntime = null,
    requestRuntime = null,
    businessSummary = {},
  } = {}) {
    return analyzeDeterministicObservations({
      companyRuntime,
      companyBrief,
      companyHealth,
      companyInsights,
      companyOpportunities,
      installation,
      analytics,
      workRuntime,
      requestRuntime,
      businessSummary,
    });
  }

  recommend({ findings = [], companyRecommendations = null, businessSummary = {} } = {}) {
    const governed = [];
    const seen = new Set();

    for (const finding of findings) {
      if (seen.has(finding.findingId)) continue;
      seen.add(finding.findingId);

      const reuse = this.reuseResolver.resolve({
        observationKind: finding.kind,
        businessSummary,
        evidence: finding.evidenceLabels ?? [],
        prefersConfiguration: Boolean(finding.prefersConfiguration),
      });

      const rec = createGovernedRecommendation({
        recommendationId: `grec_${finding.findingId}`,
        title: finding.claim,
        summary: finding.businessImpact,
        reason: finding.claim,
        evidence: finding.evidenceLabels ?? [],
        confidence: finding.confidence,
        businessImpact: finding.businessImpact,
        affectedDepartments: finding.affectedDepartments ?? [],
        affectedEmployees: finding.affectedEmployees ?? [],
        estimatedSavings: finding.estimatedSavings,
        risk: finding.risk ?? "medium",
        requiredApprovals: finding.requiredApprovals ?? ["owner"],
        reuse,
        category: finding.category ?? "operations",
        priority: finding.priority ?? "soon",
        nextStep: "explain",
        improvePrompt: finding.improvePrompt ?? finding.claim,
        source: finding.source ?? "business_intelligence_layer",
      });

      const validation = validateGovernedRecommendation(rec);
      if (!validation.ok) {
        throw new Error(`BusinessIntelligenceLayer: invalid recommendation (${validation.error})`);
      }
      governed.push(rec);
    }

    // Lift existing company recommendations that weren't covered by observation findings.
    for (const entry of companyRecommendations?.recommendations ?? []) {
      const key = `company_${entry.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const reuse = this.reuseResolver.resolve({
        observationKind: entry.category,
        businessSummary,
        evidence: [entry.reason],
        prefersConfiguration: /profile|knowledge|terminology/i.test(String(entry.category)),
      });

      governed.push(createGovernedRecommendation({
        recommendationId: `grec_${entry.id}`,
        title: entry.title,
        summary: entry.summary,
        reason: entry.reason,
        evidence: [entry.reason, `Source action: ${entry.action}`],
        confidence: "medium",
        businessImpact: `${entry.impact} impact · ${entry.effort} effort`,
        affectedDepartments: [humanizeCategory(entry.category)],
        affectedEmployees: ["Owner"],
        estimatedSavings: null,
        risk: entry.priority === "immediate" ? "medium" : "low",
        requiredApprovals: ["owner"],
        reuse,
        category: mapCompanyCategory(entry.category),
        priority: ["immediate", "soon", "later"].includes(String(entry.priority))
        ? String(entry.priority)
        : "soon",
        nextStep: "explain",
        improvePrompt: entry.title,
        source: "company_recommendation_engine",
      }));
    }

    return Object.freeze(prioritize(governed));
  }
}

export function createBusinessIntelligenceWorkspace(fields) {
  return deepFreeze({
    contract: "BusinessIntelligenceWorkspace/v1",
    companyId: String(fields.companyId),
    generatedAt: String(fields.generatedAt),
    executiveBriefing: deepFreeze(fields.executiveBriefing),
    recommendations: Object.freeze([...(fields.recommendations ?? [])]),
    opportunities: Object.freeze([...(fields.opportunities ?? [])]),
    businessHealth: deepFreeze(fields.businessHealth),
    risks: Object.freeze([...(fields.risks ?? [])]),
    capacity: Object.freeze([...(fields.capacity ?? [])]),
    aiSuggestions: Object.freeze([...(fields.aiSuggestions ?? [])]),
    recentImprovements: Object.freeze([...(fields.recentImprovements ?? [])]),
    futureRoadmap: Object.freeze([...(fields.futureRoadmap ?? [])]),
    changes: Object.freeze([...(fields.changes ?? [])]),
    improving: Object.freeze([...(fields.improving ?? [])]),
    worsening: Object.freeze([...(fields.worsening ?? [])]),
    pipeline: Object.freeze([...(fields.pipeline ?? GOVERNANCE_PIPELINE)]),
    mutatesBusinessOs: false,
    observationCounts: deepFreeze(fields.observationCounts ?? {}),
  });
}

function buildExecutiveBriefing(observed, analyzed, recommendations) {
  const health = observed.companyHealth;
  const top = recommendations[0] ?? null;
  const immediate = recommendations.filter((entry) => entry.priority === "immediate").length;
  return deepFreeze({
    headline: observed.companyBrief?.greeting
      ?? health?.summary
      ?? "Continuous business intelligence is watching your operating system.",
    summary: [
      observed.companyBrief?.summary || null,
      analyzed.counts.findings
        ? `${analyzed.counts.findings} evidence-backed findings`
        : "No new findings yet",
      immediate ? `${immediate} need attention now` : "Nothing urgent",
      health?.overallStatus ? `Health: ${health.overallStatus}` : null,
    ].filter(Boolean).join(" · "),
    whatChanged: analyzed.findings.filter((f) => f.category === "change").slice(0, 3).map((f) => f.claim),
    whatNeedsAttention: recommendations.filter((r) => r.priority === "immediate").slice(0, 3).map((r) => r.title),
    topRecommendation: top ? {
      title: top.title,
      reason: top.reason,
      confidence: top.confidence,
    } : null,
    nextHumanStep: top
      ? `Explain → Preview → Dry run → Approve → Install (${top.title})`
      : "Continue operating — Architect will propose when evidence warrants it.",
  });
}

function summarizeHealth(health) {
  if (!health) {
    return deepFreeze({
      overallScore: null,
      overallStatus: "unknown",
      overallTrend: "unknown",
      overallConfidence: "unknown",
      strengths: [],
      risks: [],
      dimensions: [],
      explanation: "Company health has not been computed yet.",
    });
  }
  return deepFreeze({
    overallScore: health.overallScore ?? null,
    overallStatus: health.overallStatus ?? "unknown",
    overallTrend: health.overallTrend ?? "stable",
    overallConfidence: typeof health.overallConfidence === "number"
      ? (health.overallConfidence >= 0.8 ? "high" : health.overallConfidence >= 0.5 ? "medium" : "low")
      : String(health.overallConfidence ?? "medium"),
    strengths: Object.freeze([...(health.strengths ?? [])].map((entry) => ({
      id: String(entry.id ?? entry.title ?? entry),
      label: String(entry.title ?? entry.label ?? entry.summary ?? entry),
      reason: String(entry.reason ?? entry.summary ?? ""),
    }))),
    risks: Object.freeze([...(health.risks ?? [])].map((entry) => ({
      id: String(entry.id ?? entry.title ?? entry),
      label: String(entry.title ?? entry.label ?? entry.summary ?? entry),
      reason: String(entry.reason ?? entry.summary ?? ""),
      priority: String(entry.priority ?? "MEDIUM"),
    }))),
    dimensions: Object.freeze([...(health.dimensions ?? [])].map((entry) => ({
      id: String(entry.id ?? entry.key ?? entry.label),
      label: String(entry.label ?? entry.id ?? "Dimension"),
      score: entry.score ?? null,
      status: entry.status ?? null,
      explanation: String(entry.explanation ?? entry.reason ?? ""),
    }))),
    explanation: String(health.summary ?? "Health derived from operating signals — not an opaque AI score."),
  });
}

function buildRoadmap(recommendations) {
  const tiers = [
    { id: "now", label: "Now", items: recommendations.filter((r) => r.priority === "immediate").slice(0, 5) },
    { id: "next", label: "Next", items: recommendations.filter((r) => r.priority === "soon").slice(0, 5) },
    { id: "later", label: "Later", items: recommendations.filter((r) => r.priority === "later").slice(0, 5) },
  ];
  return Object.freeze(tiers.map((tier) => deepFreeze({
    id: tier.id,
    label: tier.label,
    items: Object.freeze(tier.items.map((item) => deepFreeze({
      recommendationId: item.recommendationId,
      title: item.title,
      reuseStrategy: item.reuse?.strategy ?? null,
      risk: item.risk,
    }))),
  })));
}

function deriveTrendItems(health, mode) {
  const dimensions = Array.isArray(health?.dimensions) ? health.dimensions : [];
  return Object.freeze(dimensions
    .filter((dimension) => {
      const trend = String(dimension.trend ?? health?.overallTrend ?? "").toLowerCase();
      if (mode === "improving") return /up|improv|better|rising/.test(trend);
      if (mode === "worsening") return /down|wors|declin|falling/.test(trend);
      return false;
    })
    .map((dimension) => deepFreeze({
      id: String(dimension.id ?? dimension.label),
      label: String(dimension.label ?? dimension.id),
      explanation: String(dimension.explanation ?? dimension.reason ?? `${dimension.label} is ${mode}`),
    })));
}

function prioritize(list) {
  const rank = { immediate: 0, soon: 1, later: 2 };
  const riskRank = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => {
    const pr = (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9);
    if (pr !== 0) return pr;
    return (riskRank[a.risk] ?? 9) - (riskRank[b.risk] ?? 9);
  });
}

function normalizeImprovement(entry) {
  if (typeof entry === "string") {
    return deepFreeze({ id: entry, label: entry, at: null });
  }
  return deepFreeze({
    id: String(entry.id ?? entry.label ?? "improvement"),
    label: String(entry.label ?? entry.title ?? entry.id),
    at: entry.at == null ? null : String(entry.at),
  });
}

function humanizeCategory(category) {
  return String(category ?? "operations").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapCompanyCategory(category) {
  const c = String(category ?? "");
  if (c.includes("workforce") || c.includes("digital")) return "ai_suggestion";
  if (c.includes("work") || c.includes("connected") || c.includes("knowledge")) return "risk";
  return "opportunity";
}
