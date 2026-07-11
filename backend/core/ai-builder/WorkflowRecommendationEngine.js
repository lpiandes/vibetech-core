import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { WorkflowEngine } from "../workflows/WorkflowEngine.js";

/**
 * Thin facade — builder-style API over WorkflowEngine.
 * Specialize reusable workflow archetypes; never invent one-off workflows.
 */
export class WorkflowRecommendationEngine {
  constructor({ workflowEngine = new WorkflowEngine() } = {}) {
    this.workflowEngine = workflowEngine;
  }

  recommend({
    businessSummary = {},
    dna = null,
    evidence = [],
    businessId = null,
    organization = null,
  } = {}) {
    const result = this.workflowEngine.recommendWorkflows({
      businessSummary,
      dna,
      evidence,
      businessId,
      organization,
    });

    return deepFreeze({
      ok: true,
      recommendations: result.workflows,
      gaps: result.gaps,
      workflowModel: result.workflowModel,
      businessOsMapping: result.businessOsMapping,
      allRecommendations: result.recommendations,
    });
  }
}
