import { IndustryTemplateRegistry } from "./IndustryTemplateRegistry.js";
import { BusinessProfileValidator } from "./BusinessProfileValidator.js";
import { createBusinessProfileDefaults } from "./BusinessProfileDefaults.js";
import { createBusinessProfile } from "./BusinessProfile.js";

function deterministicNowISO(nowISO) {
  return typeof nowISO === "string" ? new Date(nowISO).toISOString() : nowISO;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export class BusinessProfileBuilder {
  static build({ companyProfile, overrides = {}, nowISO } = {}) {
    if (!companyProfile || typeof companyProfile !== "object") {
      throw new Error("BusinessProfileBuilder.build requires `companyProfile`.");
    }

    const registry = new IndustryTemplateRegistry();
    const primaryIndustry = String(companyProfile?.general?.industry ?? companyProfile?.general?.companyName ?? "").trim();
    const template = registry.selectTemplateForIndustry(primaryIndustry);

    const built = {
      industry: {
        primaryIndustry,
        industryTemplate: {
          id: template.id,
          name: template.name,
          description: template.description,
        },
      },
      businessSegments: safeArray(template.businessSegments),
      servicesOffered: safeArray(template.servicesOffered),
      customerTypes: safeArray(template.customerTypes),
      serviceAreas: safeArray(template.serviceAreas),
      operatingModel: String(template.operatingModel ?? ""),
      companySize: String(template.companySize ?? ""),
      languagesSupported: safeArray(template.languagesSupported),
      emergencyServices: Boolean(template.emergencyServices),
      appointmentBased: Boolean(template.appointmentBased),
      remoteOrOnsite: String(template.remoteOrOnsite ?? "HYBRID"),
      businessGoals: safeArray(template.businessGoals),
      industryTemplate: template, // template contract stored for future consumption
      metadata: {
        ...createBusinessProfileDefaults().metadata,
        createdAtISO: String(overrides?.metadata?.createdAtISO ?? nowISO ?? ""),
        updatedAtISO: String(overrides?.metadata?.updatedAtISO ?? nowISO ?? ""),
        version: Number(overrides?.metadata?.version ?? 1),
      },
    };

    // Deterministic derived metadata recommendations (contract-only).
    const recommendations = {
      recommendedCapabilities: safeArray(template.recommendedCapabilities),
      recommendedDigitalEmployees: safeArray(template.recommendedDigitalEmployees),
      recommendedKnowledgeCategories: safeArray(template.recommendedKnowledgeCategories),
      recommendedDashboardModules: safeArray(template.recommendedDashboardModules),
      recommendedKPIs: safeArray(template.recommendedKPIs),
      recommendedIntegrations: safeArray(template.recommendedIntegrations),
      recommendedOnboardingPath: ["CompanyProfile", "BusinessProfile", "BrandSetup", "Integrations"],
    };

    const validation = BusinessProfileValidator.validate({ profile: built });
    built.metadata.completionPercent = validation.completionPercent;
    built.metadata.completionStatus = validation.completionStatus;
    built.metadata.validation = validation.validation;
    built.metadata.derived = {
      templateId: template.id,
      recommendations,
    };

    return createBusinessProfile(built);
  }
}

