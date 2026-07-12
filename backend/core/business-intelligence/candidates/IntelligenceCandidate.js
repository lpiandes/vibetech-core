import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createHash, randomUUID } from "node:crypto";
import { createEvidenceReference } from "../evidence/EvidenceReference.js";

export const INTELLIGENCE_CANDIDATE_STATUSES = Object.freeze([
  "DETECTED",
  "SURFACED",
  "IN_REVIEW",
  "CONVERTED_TO_WORK",
  "CONVERTED_TO_CHANGE_PROPOSAL",
  "DISMISSED",
  "RESOLVED",
  "EXPIRED",
]);

export const OPEN_CANDIDATE_STATUSES = Object.freeze([
  "DETECTED",
  "SURFACED",
  "IN_REVIEW",
]);

/**
 * Canonical Intelligence Candidate — lifecycle-managed, never auto-creates Work.
 */
export function createIntelligenceCandidate({
  id = null,
  businessId,
  definitionId,
  observationIds = [],
  insightId = null,
  recommendationId = null,
  status = "DETECTED",
  title,
  summary,
  explanation,
  severity = "medium",
  confidence = 0.7,
  confidenceReason,
  evidence = [],
  missingEvidence = [],
  recommendedActions = [],
  ownerRef = null,
  relatedObjectRefs = [],
  deduplicationKey,
  source = "business_intelligence",
  packageMetadata = {},
  detectedAt = new Date().toISOString(),
  lastEvaluatedAt = null,
  surfacedAt = null,
  dismissedAt = null,
  dismissalReason = null,
  resolvedAt = null,
  convertedWorkId = null,
  architectSessionId = null,
  version = 1,
  metadata = {},
} = {}) {
  if (!businessId) throw new Error("IntelligenceCandidate: businessId required.");
  if (!definitionId) throw new Error("IntelligenceCandidate: definitionId required.");
  if (!title) throw new Error("IntelligenceCandidate: title required.");
  if (!summary) throw new Error("IntelligenceCandidate: summary required.");
  if (!explanation) throw new Error("IntelligenceCandidate: explanation required.");
  if (!confidenceReason) throw new Error("IntelligenceCandidate: confidenceReason required.");
  if (!deduplicationKey) throw new Error("IntelligenceCandidate: deduplicationKey required.");
  if (!INTELLIGENCE_CANDIDATE_STATUSES.includes(String(status))) {
    throw new Error(`IntelligenceCandidate: invalid status ${status}`);
  }
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("IntelligenceCandidate: evidence required — no opaque recommendations.");
  }

  const frozenEvidence = evidence.map((entry) => (
    entry?.objectType ? createEvidenceReference(entry) : entry
  ));

  const candidateId = id ?? `intel_${createHash("sha256")
    .update(`${businessId}:${deduplicationKey}`)
    .digest("hex")
    .slice(0, 20)}`;

  return deepFreeze({
    id: String(candidateId),
    businessId: String(businessId),
    definitionId: String(definitionId),
    observationIds: deepFreeze(observationIds.map(String)),
    insightId: insightId == null ? null : String(insightId),
    recommendationId: recommendationId == null ? null : String(recommendationId),
    status: String(status),
    title: String(title),
    summary: String(summary),
    explanation: String(explanation),
    severity: String(severity),
    confidence: Number(confidence),
    confidenceReason: String(confidenceReason),
    evidence: deepFreeze(frozenEvidence),
    missingEvidence: deepFreeze((missingEvidence ?? []).map(String)),
    recommendedActions: deepFreeze((recommendedActions ?? []).map((action) => deepFreeze({
      actionId: String(action.actionId ?? randomUUID().slice(0, 8)),
      kind: String(action.kind),
      label: String(action.label ?? action.kind),
      workTemplate: action.workTemplate ?? null,
      architectCapabilityId: action.architectCapabilityId ?? null,
      requiresApproval: action.requiresApproval !== false,
    }))),
    ownerRef: ownerRef == null ? null : deepFreeze(ownerRef),
    relatedObjectRefs: deepFreeze(relatedObjectRefs ?? []),
    deduplicationKey: String(deduplicationKey),
    source: String(source),
    packageMetadata: deepFreeze(packageMetadata ?? {}),
    detectedAt: String(detectedAt),
    lastEvaluatedAt: lastEvaluatedAt == null ? String(detectedAt) : String(lastEvaluatedAt),
    surfacedAt: surfacedAt == null ? null : String(surfacedAt),
    dismissedAt: dismissedAt == null ? null : String(dismissedAt),
    dismissalReason: dismissalReason == null ? null : String(dismissalReason),
    resolvedAt: resolvedAt == null ? null : String(resolvedAt),
    convertedWorkId: convertedWorkId == null ? null : String(convertedWorkId),
    architectSessionId: architectSessionId == null ? null : String(architectSessionId),
    version: Number(version),
    metadata: deepFreeze(metadata ?? {}),
  });
}

export function isOpenIntelligenceCandidate(candidate) {
  return OPEN_CANDIDATE_STATUSES.includes(String(candidate?.status));
}
