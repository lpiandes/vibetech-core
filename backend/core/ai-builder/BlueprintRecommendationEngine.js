import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBuilderRecommendation } from "./BuilderRecommendation.js";
import { getDefaultBlueprintRegistry } from "../blueprints/BlueprintRegistry.js";
import { isFullOsPurchasedScope } from "../platform/packages/SalesPackageCatalog.js";

/**
 * Prefer active operating packs over legacy fixtures. Historical blueprints
 * remain readable for migrations and test coverage, but a new Builder session
 * must never install one merely because the owner's wording resembles a demo.
 *
 * Thin purchased packages always assemble on universal core — sports/dental
 * packs are Full OS accelerators only.
 */
export class BlueprintRecommendationEngine {
  constructor({ registry = getDefaultBlueprintRegistry() } = {}) {
    this.registry = registry;
  }

  recommend({ businessSummary = {}, evidence = [] } = {}) {
    const industry = String(businessSummary.industry ?? "").toLowerCase().replace(/\s+/g, "_");
    const purchasedPackages = businessSummary.purchasedPackages ?? [];
    const thinSku = !isFullOsPurchasedScope(purchasedPackages);
    const recommendations = [];
    void evidence;

    if (thinSku) {
      const core = this.registry.get("bp_platform_universal_core");
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_universal",
        kind: "blueprint",
        label: core?.name ?? "Universal Core",
        why: "Assemble only the modules entitled by purchased packages — industry wording does not unlock a full vertical pack.",
        evidence: ["purchased_packages:thin", industry ? `industry:${industry}` : "fallback:universal"],
        confidence: 0.8,
        selected: true,
        missingCapabilities: [],
      }));
      return deepFreeze({ ok: true, recommendations });
    }

    if (industry === "sports" || industry === "hockey") {
      recommendations.push(createBuilderRecommendation({
        recommendationId: "rec_bp_sports_club",
        kind: "operating_pack",
        label: "Sports club operating pack",
        why: "Start with the Sports operating pack. Architect adds only the records, workflows, and AI teammates confirmed in your answers — never a prebuilt hockey tenant.",
        evidence: ["industry:sports"],
        confidence: 0.82,
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
