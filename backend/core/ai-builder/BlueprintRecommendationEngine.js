import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "./BuilderRecommendation.js";
import { getDefaultBlueprintRegistry } from "../blueprints/BlueprintRegistry.js";

/**
 * Prefer existing Gold / industry blueprints over custom generation.
 * Only select property Gold when industry is explicitly property_management —
 * never from weak evidence regex matches (that wrongly installs McBride for
 * marketing / other businesses).
 */
export class BlueprintRecommendationEngine {
  constructor({ registry = getDefaultBlueprintRegistry() } = {}) {
    this.registry = registry;
  }

  recommend({ businessSummary = {}, evidence = [] } = {}) {
    const industry = String(businessSummary.industry ?? "").toLowerCase().replace(/\s+/g, "_");
    const recommendations = [];
    void evidence;

    if (industry === "property_management" || industry === "property" || industry === "real_estate") {
      const gold = this.registry.get("bp_gold_property_management_mcbride");
      if (gold) {
        recommendations.push(createBuilderRecommendation({
          recommendationId: "rec_bp_pm_gold",
          kind: "blueprint",
          label: gold.name,
          why: "Matches confirmed property management operations using the reusable property Gold blueprint.",
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
    } else if (industry === "professional_services" || industry === "legal" || industry === "accounting") {
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_professional_services_universal",
        kind: "blueprint",
        label: "Professional services on universal core",
        why: "Engagement, intake, and client communication run on universal modules with honest billing gaps.",
        evidence: ["industry:professional_services"],
        confidence: 0.74,
        alternatives: ["bp_platform_universal_core"],
        selected: true,
        missingCapabilities: ["time_billing_execution", "conflicts_engine"],
        assumptions: ["Clients map to People; matters map to Work records."],
      }));
    } else if (industry === "political_campaigns" || industry === "campaign") {
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_campaign_universal",
        kind: "blueprint",
        label: "Political campaign on universal core",
        why: "Voter, volunteer, and donor outreach uses universal intake and campaigns — no packaged FEC filing engine.",
        evidence: ["industry:political_campaigns"],
        confidence: 0.72,
        alternatives: ["bp_platform_universal_core"],
        selected: true,
        missingCapabilities: ["fec_filing", "compliance_automation"],
        assumptions: [
          "Campaign compliance rules become owner-approved policies.",
          "Fundraising and GOTV channels require owner-connected accounts.",
        ],
      }));
    } else if (
      industry === "marketing"
      || industry === "marketing_agency"
      || industry === "agency"
      || industry === "advertising"
    ) {
      const core = this.registry.get("bp_platform_universal_core");
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_marketing_universal",
        kind: "blueprint",
        label: core?.name ?? "Marketing on universal core",
        why: "Marketing / agency businesses run on universal modules — intake, campaigns, and follow-up. Connect email, SMS, phone, or Facebook leads in Integrations when you need those channels.",
        evidence: ["industry:marketing"],
        confidence: 0.78,
        alternatives: ["bp_platform_universal_core"],
        selected: true,
        missingCapabilities: [],
        assumptions: [
          "Lead intake and campaigns operate through connected channels after owner approval.",
        ],
      }));
    } else {
      const core = this.registry.get("bp_platform_universal_core");
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_universal",
        kind: "blueprint",
        label: core?.name ?? "Universal Core",
        why: "Industry is unclear or unsupported — start from universal reusable capabilities that can operate today (email, work, people, AI teammates).",
        evidence: ["fallback:universal"],
        confidence: 0.55,
        selected: true,
        missingCapabilities: [],
      }));
    }

    return deepFreeze({ ok: true, recommendations });
  }
}
