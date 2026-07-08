import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`KnowledgeReadinessReport: ${message}`);
}

export function createKnowledgeReadinessReport({
  reportId,
  companyId,
  generatedAt,
  summary,
  health,
  coverage,
  metrics,
  areas,
  gaps,
  risks,
  strengths,
  recommendations,
  nextFocusSubtitle,
} = {}) {
  if (!reportId || typeof reportId !== "string") fail("reportId required string.");
  if (!companyId || typeof companyId !== "string") fail("companyId required string.");
  if (!generatedAt || typeof generatedAt !== "string") fail("generatedAt required string.");
  if (!summary || typeof summary !== "string") fail("summary required string.");
  if (!health || typeof health !== "object") fail("health required object.");
  if (!coverage || typeof coverage !== "object") fail("coverage required object.");
  if (!metrics || typeof metrics !== "object") fail("metrics required object.");

  if (!Array.isArray(areas)) fail("areas required array.");
  if (!Array.isArray(gaps)) fail("gaps required array.");
  if (!Array.isArray(risks)) fail("risks required array.");
  if (!Array.isArray(strengths)) fail("strengths required array.");
  if (!Array.isArray(recommendations)) fail("recommendations required array.");

  const report = {
    reportId,
    companyId,
    generatedAt,
    summary,
    health,
    coverage,
    metrics,
    areas: deepFreeze(areas),
    gaps: deepFreeze(gaps),
    risks: deepFreeze(risks),
    strengths: deepFreeze(strengths),
    recommendations: deepFreeze(recommendations),
    nextFocusSubtitle: String(nextFocusSubtitle ?? ""),
  };

  return deepFreeze(report);
}
