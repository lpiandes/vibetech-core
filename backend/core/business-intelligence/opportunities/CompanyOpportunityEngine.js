import { buildCompanyOpportunities } from "./CompanyOpportunityBuilder.js";
import { validateCompanyOpportunities } from "./CompanyOpportunityValidator.js";

export class CompanyOpportunityEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  generate({
    companyRuntime,
    companyBrief,
    companyHealth,
    companyInsights,
    capabilityEngine,
    knowledgeRepository,
    connectedSystems,
    communicationSetup,
    workQueue,
    employees,
    businessProfile,
    companyProfile,
    activities,
    nowISO,
  } = {}) {
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";

    const opportunities = buildCompanyOpportunities({
      companyRuntime,
      companyBrief,
      companyHealth,
      companyInsights,
      capabilityEngine,
      knowledgeRepository,
      connectedSystems,
      communicationSetup,
      workQueue,
      employees,
      businessProfile,
      companyProfile,
      activities,
      nowISO: effectiveNowISO,
    });

    validateCompanyOpportunities(opportunities);
    return opportunities;
  }
}

