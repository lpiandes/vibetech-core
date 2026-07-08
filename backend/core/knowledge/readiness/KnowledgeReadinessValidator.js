import { createKnowledgeReadinessReport } from "./KnowledgeReadinessReport.js";

export function validateKnowledgeReadinessReport(report) {
  if (!report || typeof report !== "object") throw new Error("validateKnowledgeReadinessReport: report required.");
  // Validation is performed by the report constructor.
  createKnowledgeReadinessReport(report);
  return true;
}
