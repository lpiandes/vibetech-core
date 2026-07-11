import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { DataFormsEngine } from "../data-forms/DataFormsEngine.js";

/**
 * Thin facade — preserves builder-style API while delegating to DataFormsEngine.
 * Specialize reusable object archetypes; never invent one-off objects.
 */
export class ObjectRecommendationEngine {
  constructor({ dataFormsEngine = new DataFormsEngine() } = {}) {
    this.dataFormsEngine = dataFormsEngine;
  }

  recommend({ businessSummary = {}, dna = null, evidence = [], businessId = null } = {}) {
    const result = this.dataFormsEngine.recommendDataModel({
      businessSummary,
      dna,
      evidence,
      businessId,
    });

    return deepFreeze({
      ok: true,
      recommendations: result.objects,
      gaps: result.gaps,
      dataModel: result.dataModel,
      businessOsMapping: result.businessOsMapping,
      allRecommendations: result.recommendations,
    });
  }
}
