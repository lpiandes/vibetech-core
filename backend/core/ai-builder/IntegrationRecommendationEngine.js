import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { IntegrationHubEngine } from "../integrations/hub/IntegrationHubEngine.js";

/**
 * Thin facade — builder-style API over IntegrationHubEngine.
 * Recommend reusable providers by capability — never invent one-off connectors.
 */
export class IntegrationRecommendationEngine {
  constructor({ integrationHubEngine = new IntegrationHubEngine() } = {}) {
    this.integrationHubEngine = integrationHubEngine;
  }

  recommend({
    businessSummary = {},
    dna = null,
    evidence = [],
    businessId = null,
    existingConnections = [],
  } = {}) {
    const result = this.integrationHubEngine.recommendIntegrations({
      businessSummary,
      dna,
      evidence,
      businessId,
      existingConnections,
    });

    return deepFreeze({
      ok: true,
      recommendations: result.integrations,
      gaps: result.gaps,
      integrationModel: result.integrationModel,
      businessOsMapping: result.businessOsMapping,
      allRecommendations: result.recommendations,
    });
  }
}
