import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  createObservationDefinition,
  createInsightDefinition,
  createRecommendationDefinition,
} from "./DefinitionFactories.js";

/**
 * Unified registry for observation, insight, and recommendation definitions.
 * Packages register without editing the evaluation engine.
 */
export class BusinessIntelligenceDefinitionRegistry {
  constructor() {
    this._observations = new Map();
    this._insights = new Map();
    this._recommendations = new Map();
    this._evaluators = new Map();
  }

  registerObservation(definitionInput, { replace = false, source = "core" } = {}) {
    const definition = createObservationDefinition(definitionInput);
    if (this._observations.has(definition.definitionId) && !replace) {
      throw new Error(`BusinessIntelligenceDefinitionRegistry: duplicate observation ${definition.definitionId}`);
    }
    this._observations.set(definition.definitionId, deepFreeze({ ...definition, _source: source }));
    return this._observations.get(definition.definitionId);
  }

  registerInsight(definitionInput, { replace = false, source = "core" } = {}) {
    const definition = createInsightDefinition(definitionInput);
    if (this._insights.has(definition.definitionId) && !replace) {
      throw new Error(`BusinessIntelligenceDefinitionRegistry: duplicate insight ${definition.definitionId}`);
    }
    this._insights.set(definition.definitionId, deepFreeze({ ...definition, _source: source }));
    return this._insights.get(definition.definitionId);
  }

  registerRecommendation(definitionInput, { replace = false, source = "core" } = {}) {
    const definition = createRecommendationDefinition(definitionInput);
    if (this._recommendations.has(definition.definitionId) && !replace) {
      throw new Error(`BusinessIntelligenceDefinitionRegistry: duplicate recommendation ${definition.definitionId}`);
    }
    this._recommendations.set(definition.definitionId, deepFreeze({ ...definition, _source: source }));
    return this._recommendations.get(definition.definitionId);
  }

  registerEvaluator(evaluatorId, fn) {
    if (typeof fn !== "function") {
      throw new Error("BusinessIntelligenceDefinitionRegistry: evaluator must be a function.");
    }
    this._evaluators.set(String(evaluatorId), fn);
  }

  getEvaluator(evaluatorId) {
    return this._evaluators.get(String(evaluatorId)) ?? null;
  }

  listObservations({ industryPackageId = null } = {}) {
    return [...this._observations.values()].filter((entry) => (
      entry.availability.defaultEnabled
      && (
        !industryPackageId
        || entry.availability.industryPackageIds.length === 0
        || entry.availability.industryPackageIds.includes(String(industryPackageId))
      )
    ));
  }

  listInsights(filter = {}) {
    return [...this._insights.values()].filter((entry) => (
      entry.availability.defaultEnabled
      && (
        !filter.industryPackageId
        || entry.availability.industryPackageIds.length === 0
        || entry.availability.industryPackageIds.includes(String(filter.industryPackageId))
      )
    ));
  }

  listRecommendations(filter = {}) {
    return [...this._recommendations.values()].filter((entry) => (
      entry.availability.defaultEnabled
      && (
        !filter.industryPackageId
        || entry.availability.industryPackageIds.length === 0
        || entry.availability.industryPackageIds.includes(String(filter.industryPackageId))
      )
    ));
  }

  getObservation(id) { return this._observations.get(String(id)) ?? null; }
  getInsight(id) { return this._insights.get(String(id)) ?? null; }
  getRecommendation(id) { return this._recommendations.get(String(id)) ?? null; }
}

let defaultRegistry = null;

export function getDefaultBusinessIntelligenceDefinitionRegistry() {
  if (!defaultRegistry) defaultRegistry = new BusinessIntelligenceDefinitionRegistry();
  return defaultRegistry;
}

export function resetDefaultBusinessIntelligenceDefinitionRegistryForTests() {
  defaultRegistry = new BusinessIntelligenceDefinitionRegistry();
  return defaultRegistry;
}
