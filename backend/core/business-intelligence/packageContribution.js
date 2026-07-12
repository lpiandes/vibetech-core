import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { getDefaultBusinessIntelligenceDefinitionRegistry } from "./definitions/BusinessIntelligenceDefinitionRegistry.js";

/**
 * Package/blueprint contribution hook for Business Intelligence definitions.
 * Industry packages register without editing central evaluators.
 */
export function contributeBusinessIntelligenceDefinitions({
  source,
  observations = [],
  insights = [],
  recommendations = [],
  evaluators = {},
  registry = getDefaultBusinessIntelligenceDefinitionRegistry(),
} = {}) {
  if (!source) throw new Error("contributeBusinessIntelligenceDefinitions: source required.");

  for (const [evaluatorId, fn] of Object.entries(evaluators)) {
    registry.registerEvaluator(evaluatorId, fn);
  }

  const registered = {
    observations: [],
    insights: [],
    recommendations: [],
  };

  for (const definition of observations) {
    registered.observations.push(
      registry.registerObservation(definition, { replace: true, source: String(source) }).definitionId,
    );
  }
  for (const definition of insights) {
    registered.insights.push(
      registry.registerInsight(definition, { replace: true, source: String(source) }).definitionId,
    );
  }
  for (const definition of recommendations) {
    registered.recommendations.push(
      registry.registerRecommendation(definition, { replace: true, source: String(source) }).definitionId,
    );
  }

  return deepFreeze({
    ok: true,
    source: String(source),
    registered,
  });
}

export function createPackageBusinessIntelligenceContribution(packageId) {
  return {
    register(contribution) {
      return contributeBusinessIntelligenceDefinitions({
        source: packageId,
        ...contribution,
      });
    },
  };
}
