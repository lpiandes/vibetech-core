import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Architect Intelligence Engine stages — Business Systems Architect, not chatbot.
 */
export const ARCHITECT_PIPELINE_STAGES = Object.freeze([
  "business_discovery",
  "website_intelligence",
  "document_intelligence",
  "business_understanding",
  "business_dna",
  "business_analysis",
  "blueprint_matching",
  "component_matching",
  "employee_generation",
  "workflow_generation",
  "navigation_generation",
  "dashboard_generation",
  "knowledge_generation",
  "integration_generation",
  "gap_analysis",
  "business_os_generation",
  "preview_generation",
  "continuous_improvement_planning",
]);

export function isArchitectPipelineStage(stageId) {
  return ARCHITECT_PIPELINE_STAGES.includes(String(stageId));
}

export function architectPipelineIndex(stageId) {
  return ARCHITECT_PIPELINE_STAGES.indexOf(String(stageId));
}

export function summarizePipeline(stageResults = []) {
  const byId = Object.fromEntries(stageResults.map((entry) => [entry.stageId, entry]));
  const missing = ARCHITECT_PIPELINE_STAGES.filter((stageId) => !byId[stageId]);
  const lowConfidence = stageResults.filter((entry) => entry.confidence === "low" || entry.confidence === "unknown");
  const unresolved = stageResults.flatMap((entry) => entry.unresolvedQuestions ?? []);
  return deepFreeze({
    completedStages: stageResults.map((entry) => entry.stageId),
    missingStages: missing,
    lowConfidenceStages: lowConfidence.map((entry) => entry.stageId),
    unresolvedQuestionCount: unresolved.length,
    overallConfidence: lowConfidence.length > stageResults.length / 2 ? "low" : "medium",
  });
}
