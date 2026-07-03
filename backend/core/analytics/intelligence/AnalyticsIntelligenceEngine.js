import { buildAnalyticsIntelligenceReport } from "./AnalyticsIntelligenceBuilder.js";
import { validateAnalyticsIntelligenceReport } from "./AnalyticsIntelligenceValidator.js";

export class AnalyticsIntelligenceEngine {
  constructor({ nowISO } = {}) {
    this.nowISO = String(nowISO ?? "2026-07-01T00:00:00.000Z");
  }

  generate({
    analyticsRuntime,
    companyId = null,
    nowISO,
    companyHealth,
    missionControl,
    workRuntime,
    requestRuntime,
    communicationRuntime,
    capabilityRuntime,
    teamRuntime,
  } = {}) {
    const report = buildAnalyticsIntelligenceReport({
      analyticsRuntime,
      companyId,
      nowISO: String(nowISO ?? this.nowISO),
      companyHealth,
      missionControl,
      workRuntime,
      requestRuntime,
      communicationRuntime,
      capabilityRuntime,
      teamRuntime,
    });

    validateAnalyticsIntelligenceReport(report);
    return report;
  }
}

