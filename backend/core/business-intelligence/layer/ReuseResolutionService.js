import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { resolveReusePreference } from "../../platform/constitution/BlueprintResolutionOrder.js";
import { BlueprintRecommendationEngine } from "../../ai-builder/BlueprintRecommendationEngine.js";
import { ComponentRecommendationEngine } from "../../ai-builder/ComponentRecommendationEngine.js";
import { EmployeeArchetypeRecommendationEngine } from "../../ai-builder/EmployeeArchetypeRecommendationEngine.js";
import { REUSE_STRATEGIES } from "./GovernedRecommendation.js";

/**
 * Prefer reusable platform assets before proposing new capabilities.
 * Order: blueprint → component → employee archetype → configuration → new capability.
 */
export class ReuseResolutionService {
  constructor({
    blueprintEngine = new BlueprintRecommendationEngine(),
    componentEngine = new ComponentRecommendationEngine(),
    archetypeEngine = new EmployeeArchetypeRecommendationEngine(),
  } = {}) {
    this.blueprintEngine = blueprintEngine;
    this.componentEngine = componentEngine;
    this.archetypeEngine = archetypeEngine;
  }

  resolve({
    observationKind,
    businessSummary = {},
    evidence = [],
    prefersConfiguration = false,
  } = {}) {
    if (prefersConfiguration) {
      return pack({
        strategy: "configuration_only",
        assetId: null,
        assetLabel: "Installed configuration",
        explanation: "An existing Business OS setting or label change can address this without new assets.",
        isGap: false,
      });
    }

    const kind = String(observationKind ?? "");
    const summary = { ...businessSummary };

    if (/employee|workforce|coordinator|capacity|split/.test(kind)) {
      const archetypes = this.archetypeEngine.recommend({ businessSummary: summary, evidence });
      const selected = archetypes.recommendations?.find((entry) => entry.selected)
        ?? archetypes.recommendations?.[0];
      if (selected) {
        const preference = resolveReusePreference({ hasEmployeeArchetype: true });
        return pack({
          strategy: "existing_employee_archetype",
          assetId: selected.recommendationId ?? selected.payload?.archetypeId ?? null,
          assetLabel: selected.label,
          explanation: selected.why ?? preference.explanation,
          isGap: false,
        });
      }
    }

    if (/workflow|intake|bottleneck|dashboard|module|workspace/.test(kind)) {
      const components = this.componentEngine.recommend({ businessSummary: summary, evidence });
      const selected = components.recommendations?.find((entry) => entry.selected)
        ?? components.recommendations?.[0];
      if (selected) {
        return pack({
          strategy: "existing_component",
          assetId: selected.recommendationId ?? selected.payload?.componentId ?? null,
          assetLabel: selected.label,
          explanation: selected.why ?? "Reuse an existing platform component before inventing a new one.",
          isGap: false,
        });
      }
    }

    const blueprints = this.blueprintEngine.recommend({ businessSummary: summary, evidence });
    const blueprint = blueprints.recommendations?.find((entry) => entry.selected)
      ?? blueprints.recommendations?.[0];
    if (blueprint && !/gap|unsupported|unclear/.test(String(blueprint.why ?? "").toLowerCase())) {
      return pack({
        strategy: "existing_blueprint",
        assetId: blueprint.recommendationId ?? blueprint.payload?.blueprintId ?? null,
        assetLabel: blueprint.label,
        explanation: blueprint.why ?? "Match an existing blueprint before proposing a platform gap.",
        isGap: false,
      });
    }

    if (/terminology|duplicate|label|rename|accent|appearance/.test(kind)) {
      return pack({
        strategy: "configuration_only",
        assetId: null,
        assetLabel: "Configuration",
        explanation: "Shared terminology and UI labels are configuration — no new capability required.",
        isGap: false,
      });
    }

    const preference = resolveReusePreference({});
    return pack({
      strategy: "new_platform_capability",
      assetId: null,
      assetLabel: null,
      explanation: preference.explanation,
      isGap: true,
    });
  }
}

function pack(fields) {
  const strategy = REUSE_STRATEGIES.includes(fields.strategy)
    ? fields.strategy
    : "new_platform_capability";
  return deepFreeze({
    ...fields,
    strategy,
  });
}
