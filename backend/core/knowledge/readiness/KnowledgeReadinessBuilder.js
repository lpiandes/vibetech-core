import { createKnowledgeReadinessReport } from "./KnowledgeReadinessReport.js";

export function buildKnowledgeReadinessReport({
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
  return createKnowledgeReadinessReport({
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
  });
}
