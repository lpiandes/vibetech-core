import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CapabilityIntelligenceReport: ${message}`);
}

export function createCapabilityIntelligenceReport({
  reportId,
  companyId,
  generatedAt,
  summary,
  overallReadiness,
  strengths,
  gaps,
  risks,
  recommendations,
  coverage,
  metadata,
} = {}) {
  if (!reportId) fail("reportId required.");
  if (!generatedAt) fail("generatedAt required.");

  const safeArray = (v) => (Array.isArray(v) ? v : []);

  const report = {
    reportId: String(reportId),
    companyId: companyId === undefined ? null : companyId === null ? null : String(companyId),
    generatedAt: String(generatedAt),
    summary: String(summary ?? ""),
    overallReadiness: Number(overallReadiness ?? 0),
    strengths: deepFreeze(safeArray(strengths)),
    gaps: deepFreeze(safeArray(gaps)),
    risks: deepFreeze(safeArray(risks)),
    recommendations: deepFreeze(safeArray(recommendations)),
    coverage: deepFreeze(coverage && typeof coverage === "object" ? coverage : {}),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(report);
}

