import { buildMissionControl } from "./MissionControlBuilder.js";
import { validateMissionControl } from "./MissionControlValidator.js";

export class MissionControlGenerator {
  constructor({ nowISO } = {}) {
    this.nowISO = nowISO;
  }

  generate({
    companyBrief,
    companyHealth,
    companyInsights,
    companyOpportunities,
    companyRecommendations,
    workspaceConfig,
    workspaceViewModel,
    companyRuntime,
    capabilityEngine,
    nowISO,
  } = {}) {
    const effectiveNowISO = nowISO ?? this.nowISO ?? "2026-07-01T00:00:00.000Z";

    const missionControl = buildMissionControl({
      companyBrief,
      companyHealth,
      companyInsights,
      companyOpportunities,
      companyRecommendations,
      workspaceConfigViewModel: workspaceViewModel,
      workspaceConfig,
      companyRuntime,
      capabilityEngine,
      nowISO: effectiveNowISO,
    });

    validateMissionControl(missionControl);
    return missionControl;
  }
}

