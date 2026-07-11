import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Governed recommendation — every BI suggestion carries explainable evidence
 * and never silently mutates the Business OS.
 */
export const GOVERNANCE_PIPELINE = Object.freeze([
  "observe",
  "analyze",
  "recommend",
  "explain",
  "preview",
  "dry_run",
  "approve",
  "install",
]);

export const REUSE_STRATEGIES = Object.freeze([
  "existing_blueprint",
  "existing_component",
  "existing_employee_archetype",
  "configuration_only",
  "new_platform_capability",
]);

export const RISK_LEVELS = Object.freeze(["low", "medium", "high"]);

export function createGovernedRecommendation({
  recommendationId,
  title,
  summary,
  reason,
  evidence = [],
  confidence = "medium",
  businessImpact,
  affectedDepartments = [],
  affectedEmployees = [],
  estimatedSavings = null,
  risk = "medium",
  requiredApprovals = ["owner"],
  reuse = null,
  category = "operations",
  priority = "soon",
  governanceStatus = "recommended",
  nextStep = "explain",
  improvePrompt = null,
  source = "business_intelligence_layer",
  mutatesBusinessOs = false,
} = {}) {
  if (!recommendationId) throw new Error("GovernedRecommendation: recommendationId required.");
  if (!title) throw new Error("GovernedRecommendation: title required.");
  if (!reason) throw new Error("GovernedRecommendation: reason required.");
  if (!businessImpact) throw new Error("GovernedRecommendation: businessImpact required.");
  if (mutatesBusinessOs) {
    throw new Error("GovernedRecommendation: recommendations must never mutate the Business OS.");
  }
  if (!RISK_LEVELS.includes(String(risk))) {
    throw new Error(`GovernedRecommendation: invalid risk ${risk}`);
  }

  const evidenceList = (Array.isArray(evidence) ? evidence : []).map((entry, index) => {
    if (typeof entry === "string") {
      return deepFreeze({
        evidenceId: `ev_${recommendationId}_${index}`,
        label: entry,
        source: "observation",
      });
    }
    return deepFreeze({
      evidenceId: String(entry.evidenceId ?? `ev_${recommendationId}_${index}`),
      label: String(entry.label ?? entry.claim ?? "Evidence"),
      source: String(entry.source ?? "observation"),
      detail: entry.detail == null ? null : String(entry.detail),
    });
  });

  if (!evidenceList.length) {
    throw new Error("GovernedRecommendation: evidence required — no opaque recommendations.");
  }

  const reuseResolution = reuse && typeof reuse === "object"
    ? deepFreeze({
        strategy: REUSE_STRATEGIES.includes(reuse.strategy) ? reuse.strategy : "configuration_only",
        assetId: reuse.assetId == null ? null : String(reuse.assetId),
        assetLabel: reuse.assetLabel == null ? null : String(reuse.assetLabel),
        explanation: String(reuse.explanation ?? "Prefer existing reusable assets."),
        isGap: Boolean(reuse.isGap),
      })
    : deepFreeze({
        strategy: "configuration_only",
        assetId: null,
        assetLabel: null,
        explanation: "Configuration change is enough until a reusable asset is identified.",
        isGap: false,
      });

  return deepFreeze({
    contract: "GovernedRecommendation/v1",
    recommendationId: String(recommendationId),
    title: String(title),
    summary: String(summary ?? title),
    reason: String(reason),
    evidence: deepFreeze(evidenceList),
    confidence: normalizeConfidence(confidence),
    businessImpact: String(businessImpact),
    affectedDepartments: Object.freeze([...affectedDepartments].map(String)),
    affectedEmployees: Object.freeze([...affectedEmployees].map(String)),
    estimatedSavings: estimatedSavings == null ? null : String(estimatedSavings),
    risk: String(risk),
    requiredApprovals: Object.freeze([...requiredApprovals].map(String)),
    reuse: reuseResolution,
    category: String(category),
    priority: String(priority),
    governanceStatus: String(governanceStatus),
    nextStep: GOVERNANCE_PIPELINE.includes(nextStep) ? nextStep : "explain",
    improvePrompt: improvePrompt == null ? String(title) : String(improvePrompt),
    source: String(source),
    mutatesBusinessOs: false,
    pipeline: GOVERNANCE_PIPELINE,
  });
}

export function validateGovernedRecommendation(rec) {
  if (!rec || rec.contract !== "GovernedRecommendation/v1") {
    return { ok: false, error: "invalid_contract" };
  }
  if (rec.mutatesBusinessOs) return { ok: false, error: "must_not_mutate" };
  if (!Array.isArray(rec.evidence) || rec.evidence.length === 0) {
    return { ok: false, error: "evidence_required" };
  }
  if (!rec.reason || !rec.businessImpact) return { ok: false, error: "explainability_required" };
  return { ok: true };
}

function normalizeConfidence(value) {
  if (typeof value === "number") {
    if (value >= 0.8) return "high";
    if (value >= 0.5) return "medium";
    return "low";
  }
  const text = String(value ?? "medium").toLowerCase();
  if (text === "high" || text === "medium" || text === "low") return text;
  return "medium";
}
