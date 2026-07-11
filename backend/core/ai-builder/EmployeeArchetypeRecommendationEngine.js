import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { WorkforceEngine } from "../workforce/WorkforceEngine.js";

/**
 * Thin facade — preserves existing builder API while delegating to WorkforceEngine.
 * Specialize reusable archetypes; never invent one-off agents.
 */
export class EmployeeArchetypeRecommendationEngine {
  constructor({ workforceEngine = new WorkforceEngine() } = {}) {
    this.workforceEngine = workforceEngine;
  }

  recommend({ businessSummary = {}, dna = null, evidence = [] } = {}) {
    const result = this.workforceEngine.recommendOrganization({
      businessSummary,
      dna,
      evidence,
    });

    // Preserve legacy callers that only expect employee archetype recommendations + gaps.
    return deepFreeze({
      ok: true,
      recommendations: result.employees,
      gaps: result.gaps,
      organization: result.organization,
      businessOsMapping: result.businessOsMapping,
      allRecommendations: result.recommendations,
    });
  }
}
