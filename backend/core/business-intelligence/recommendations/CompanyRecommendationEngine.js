import { buildRecommendationCandidates, createCompanyRecommendationFromCandidate, buildCompanySummary } from "./CompanyRecommendationBuilder.js";
import { prioritizeCompanyRecommendations } from "./CompanyRecommendationPrioritizer.js";
import { createCompanyRecommendations } from "./CompanyRecommendations.js";
import { validateCompanyRecommendations } from "./CompanyRecommendationValidator.js";

export class CompanyRecommendationEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  generate({
    companyRuntime,
    companyBrief,
    companyHealth,
    companyInsights,
    companyOpportunities,
    capabilityEngine,
    workspaceConfig,
    nowISO,
  } = {}) {
    void companyRuntime;
    void workspaceConfig;
    void capabilityEngine;

    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";

    const { candidates, companyId } = buildRecommendationCandidates({
      companyBrief,
      companyHealth,
      companyInsights,
      companyOpportunities,
      capabilityEngine,
    });

    const prioritized = prioritizeCompanyRecommendations({ candidates });

    const idToRec = new Map();
    const materialize = (candidate, priorityTier) => {
      const rec = createCompanyRecommendationFromCandidate(candidate, priorityTier);
      idToRec.set(String(rec.id), rec);
      return rec;
    };

    // Materialize in deterministic group order.
    const immediateActions = prioritized.immediateActions.map((c) => materialize(c, "immediate"));
    const nextActions = prioritized.nextActions.map((c) => materialize(c, "soon"));
    const laterActions = prioritized.laterActions.map((c) => materialize(c, "later"));

    // Ranked recommendations: full ordered list.
    const recommendations = prioritized.ranked.map((c) => idToRec.get(String(c.id)));

    const topCandidate = prioritized.topRecommendation;
    const topRecommendation = topCandidate ? idToRec.get(String(topCandidate.id)) : immediateActions[0] ?? null;

    if (!topRecommendation && recommendations.length > 0) {
      // Fallback should never happen.
      throw new Error("CompanyRecommendationEngine: missing topRecommendation materialization.");
    }

    const summary = buildCompanySummary({ topRecommendation });

    const recs = createCompanyRecommendations({
      recommendationsId: `recs_${companyId}_${effectiveNowISO}`,
      companyId,
      generatedAt: effectiveNowISO,
      summary,
      recommendations,
      topRecommendation,
      immediateActions,
      nextActions,
      laterActions,
      metadata: {
        derivedFrom: {
          brief: Boolean(companyBrief),
          health: Boolean(companyHealth),
          insights: Boolean(companyInsights),
          opportunities: Boolean(companyOpportunities),
        },
      },
    });

    validateCompanyRecommendations(recs);
    return recs;
  }
}

