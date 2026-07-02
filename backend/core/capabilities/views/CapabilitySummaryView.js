import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createCapabilitySummaryView({ overallReadiness, coverageScore, gapScore, riskScore, coverageSummary, metadata } = {}) {
  return deepFreeze({
    overallReadiness: Number(overallReadiness ?? 0),
    coverageScore: Number(coverageScore ?? 0),
    gapScore: Number(gapScore ?? 0),
    riskScore: Number(riskScore ?? 0),
    coverageSummary: String(coverageSummary ?? ""),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  });
}

