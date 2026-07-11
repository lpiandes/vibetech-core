import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Every Architect stage returns the same contract shape.
 */
export function createArchitectStageResult({
  stageId,
  inputs = {},
  outputs = {},
  confidence = "medium",
  evidence = [],
  unresolvedQuestions = [],
  recommendations = [],
  explanation = null,
  ok = true,
} = {}) {
  if (!stageId) throw new Error("ArchitectStageResult: stageId required.");
  return deepFreeze({
    contract: "ArchitectStageResult/v1",
    stageId: String(stageId),
    ok: Boolean(ok),
    inputs: deepFreeze({ ...(inputs ?? {}) }),
    outputs: deepFreeze({ ...(outputs ?? {}) }),
    confidence: normalizeConfidence(confidence),
    evidence: freezeList(evidence),
    unresolvedQuestions: freezeList(unresolvedQuestions),
    recommendations: freezeList(recommendations),
    explanation: explanation == null ? null : String(explanation),
  });
}

export function validateArchitectStageResult(result) {
  const errors = [];
  if (!result || result.contract !== "ArchitectStageResult/v1") errors.push("invalid_contract");
  if (!result?.stageId) errors.push("stageId_required");
  for (const field of ["evidence", "unresolvedQuestions", "recommendations"]) {
    if (!Array.isArray(result?.[field])) errors.push(`${field}_must_be_array`);
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

function normalizeConfidence(value) {
  if (typeof value === "number") {
    if (value >= 0.85) return "high";
    if (value >= 0.55) return "medium";
    if (value > 0) return "low";
    return "unknown";
  }
  const level = String(value ?? "medium").toLowerCase();
  return ["high", "medium", "low", "unknown"].includes(level) ? level : "medium";
}

function freezeList(value) {
  return deepFreeze(Array.isArray(value) ? value.map((entry) => (
    entry && typeof entry === "object" ? deepFreeze({ ...entry }) : entry
  )) : []);
}
