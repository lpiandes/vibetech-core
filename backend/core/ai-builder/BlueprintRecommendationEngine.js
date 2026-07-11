import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "./BuilderRecommendation.js";
import { getDefaultBlueprintRegistry } from "../blueprints/BlueprintRegistry.js";

/**
 * Prefer existing Gold / industry blueprints over custom generation.
 */
export class BlueprintRecommendationEngine {
  constructor({ registry = getDefaultBlueprintRegistry() } = {}) {
    this.registry = registry;
  }

  recommend({ businessSummary = {}, evidence = [] } = {}) {
    const industry = String(businessSummary.industry ?? "").toLowerCase();
    const recommendations = [];

    if (industry === "property_management" || /propert|leasing/.test(JSON.stringify(evidence))) {
      const gold = this.registry.get("bp_gold_property_management_mcbride");
      if (gold) {
        recommendations.push(createBuilderRecommendation({
          recommendationId: "rec_bp_pm_gold",
          kind: "blueprint",
          label: gold.name,
          why: "Matches property management operations using the McBride Gold blueprint — no custom code.",
          evidence: ["industry:property_management", "gold_blueprint"],
          confidence: 0.92,
          alternatives: ["bp_platform_universal_core"],
          selected: true,
          missingCapabilities: gold.optionalCapabilities ?? [],
        }));
      }
    } else if (industry === "sports" || industry === "hockey") {
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_hockey_fixture",
        kind: "blueprint",
        label: "Hockey Travel Club fixture blueprint",
        why: "Sports club signals match the reusable hockey travel club fixture on the universal runtime.",
        evidence: ["industry:sports"],
        confidence: 0.88,
        alternatives: ["bp_platform_universal_core"],
        selected: true,
      }));
    } else if (industry === "dental") {
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_dental_universal",
        kind: "blueprint",
        label: "Dental practice on universal core",
        why: "No dental-specific Gold blueprint yet — assemble from universal modules with patient terminology.",
        evidence: ["industry:dental"],
        confidence: 0.7,
        alternatives: ["bp_platform_universal_core"],
        selected: true,
        missingCapabilities: ["treatment_plan_runtime", "insurance_billing_execution"],
        assumptions: ["Patients map to People; appointments map to Work/scheduling setup."],
      }));
    } else {
      const core = this.registry.get("bp_platform_universal_core");
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_universal",
        kind: "blueprint",
        label: core?.name ?? "Universal Core",
        why: "Industry is unclear or unsupported — start from universal reusable capabilities.",
        evidence: ["fallback:universal"],
        confidence: 0.55,
        selected: true,
      }));
    }

    return deepFreeze({ ok: true, recommendations });
  }
}
