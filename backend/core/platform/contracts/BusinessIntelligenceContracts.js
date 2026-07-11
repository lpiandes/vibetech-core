import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Business Intelligence framework contracts.
 * Framework only — not a giant reasoning engine.
 */

export const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low", "unknown"]);

export function createIntelligenceEvidence({
  evidenceId,
  kind,
  label,
  source = "unknown",
  payload = {},
  confidence = "medium",
  mutatesCanonicalData = false,
  retrievedAt = null,
} = {}) {
  if (!evidenceId) throw new Error("BusinessIntelligenceContracts: evidenceId required.");
  return deepFreeze({
    contract: "IntelligenceEvidence/v1",
    evidenceId: String(evidenceId),
    kind: String(kind ?? "unknown"),
    label: String(label ?? kind ?? "Evidence"),
    source: String(source),
    payload: deepFreeze({ ...(payload ?? {}) }),
    confidence: normalizeConfidence(confidence),
    mutatesCanonicalData: Boolean(mutatesCanonicalData),
    retrievedAt: retrievedAt == null ? null : String(retrievedAt),
  });
}

export function createIntelligenceFinding({
  findingId,
  claim,
  evidenceIds = [],
  confidence = "medium",
  status = "proposed",
} = {}) {
  if (!findingId) throw new Error("BusinessIntelligenceContracts: findingId required.");
  if (!claim) throw new Error("BusinessIntelligenceContracts: claim required.");
  return deepFreeze({
    contract: "IntelligenceFinding/v1",
    findingId: String(findingId),
    claim: String(claim),
    evidenceIds: Object.freeze([...evidenceIds].map(String)),
    confidence: normalizeConfidence(confidence),
    status: String(status),
  });
}

export function createIntelligenceReasoning({
  reasoningId,
  premise,
  conclusion,
  evidenceIds = [],
  findingIds = [],
  confidence = "medium",
  assumptions = [],
} = {}) {
  if (!reasoningId) throw new Error("BusinessIntelligenceContracts: reasoningId required.");
  return deepFreeze({
    contract: "IntelligenceReasoning/v1",
    reasoningId: String(reasoningId),
    premise: String(premise ?? ""),
    conclusion: String(conclusion ?? ""),
    evidenceIds: Object.freeze([...evidenceIds].map(String)),
    findingIds: Object.freeze([...findingIds].map(String)),
    confidence: normalizeConfidence(confidence),
    assumptions: Object.freeze([...assumptions].map(String)),
  });
}

export function createIntelligenceConfidence({
  level = "unknown",
  score = null,
  rationale = null,
} = {}) {
  return deepFreeze({
    contract: "IntelligenceConfidence/v1",
    level: normalizeConfidence(level),
    score: score == null ? null : Number(score),
    rationale: rationale == null ? null : String(rationale),
  });
}

export function createUnresolvedIntelligenceQuestion({
  questionId,
  prompt,
  why = null,
  required = false,
  topic = null,
} = {}) {
  if (!questionId) throw new Error("BusinessIntelligenceContracts: questionId required.");
  return deepFreeze({
    contract: "UnresolvedIntelligenceQuestion/v1",
    questionId: String(questionId),
    prompt: String(prompt ?? ""),
    why: why == null ? null : String(why),
    required: Boolean(required),
    topic: topic == null ? null : String(topic),
    status: "unresolved",
  });
}

export function createIntelligenceRecommendation({
  recommendationId,
  kind,
  label,
  why,
  confidence = "medium",
  evidenceIds = [],
  alternatives = [],
  selected = false,
} = {}) {
  if (!recommendationId) throw new Error("BusinessIntelligenceContracts: recommendationId required.");
  return deepFreeze({
    contract: "IntelligenceRecommendation/v1",
    recommendationId: String(recommendationId),
    kind: String(kind ?? "general"),
    label: String(label ?? ""),
    why: String(why ?? ""),
    confidence: normalizeConfidence(confidence),
    evidenceIds: Object.freeze([...evidenceIds].map(String)),
    alternatives: Object.freeze([...alternatives].map(String)),
    selected: Boolean(selected),
  });
}

export function validateIntelligenceContract(object) {
  if (!object || typeof object !== "object") {
    return deepFreeze({ ok: false, errors: ["object_required"] });
  }
  if (!String(object.contract ?? "").includes("/v1")) {
    return deepFreeze({ ok: false, errors: ["missing_contract_version"] });
  }
  return deepFreeze({ ok: true, errors: [] });
}

function normalizeConfidence(value) {
  const level = String(value ?? "unknown").toLowerCase();
  if (CONFIDENCE_LEVELS.includes(level)) return level;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (numeric >= 0.85) return "high";
    if (numeric >= 0.55) return "medium";
    if (numeric > 0) return "low";
  }
  return "unknown";
}
