import { buildCapabilityIntelligenceReport } from "./CapabilityIntelligenceBuilder.js";
import { validateCapabilityIntelligenceReport } from "./CapabilityIntelligenceValidator.js";

export class CapabilityIntelligenceEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  generate({
    capabilityRuntime,
    teamRuntime,
    workRuntime,
    companyWorkspaceRuntime,
    companyId = "company_1",
    nowISO,
    companyHealth,
    companyRecommendations,
    workViewModel,
    teamViewModel,
  } = {}) {
    const report = buildCapabilityIntelligenceReport({
      capabilityRuntime,
      teamRuntime,
      workRuntime,
      companyWorkspaceRuntime,
      companyId,
      nowISO: String(nowISO ?? this.nowISO),
    });

    validateCapabilityIntelligenceReport(report);
    return report;
  }
}

