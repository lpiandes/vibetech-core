import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { isOpenIntelligenceCandidate } from "./IntelligenceCandidate.js";

/**
 * Presentation projection for Needs Attention / BI surfaces.
 */
export function projectIntelligenceCandidates({
  intelligenceCandidateRuntime,
  businessId = null,
} = {}) {
  const all = intelligenceCandidateRuntime?.getCandidates?.() ?? [];
  const open = all.filter(isOpenIntelligenceCandidate);
  const cards = open.map((candidate) => deepFreeze({
    id: candidate.id,
    candidateId: candidate.id,
    businessId: candidate.businessId,
    definitionId: candidate.definitionId,
    status: candidate.status,
    title: candidate.title,
    summary: candidate.summary,
    explanation: candidate.explanation,
    whatHappened: candidate.summary,
    whyItMatters: candidate.explanation,
    severity: candidate.severity,
    confidence: candidate.confidence,
    confidenceReason: candidate.confidenceReason,
    evidence: candidate.evidence,
    missingEvidence: candidate.missingEvidence,
    ownerRef: candidate.ownerRef,
    owner: candidate.ownerRef,
    relatedObjectRefs: candidate.relatedObjectRefs,
    recommendedActions: candidate.recommendedActions,
    detectedAt: candidate.detectedAt,
    lastEvaluatedAt: candidate.lastEvaluatedAt,
    convertedWorkId: candidate.convertedWorkId,
    architectSessionId: candidate.architectSessionId,
    packageMetadata: candidate.packageMetadata,
    sourceType: "intelligence_candidate",
    priority: candidate.severity,
    recommendedAction: candidate.recommendedActions?.[0]?.label ?? "Review",
    availableActions: (candidate.recommendedActions ?? []).map((action) => ({
      id: action.actionId,
      label: action.label,
      kind: action.kind,
    })).concat([
      { id: "ask_architect", label: "Ask Architect", kind: "ask_architect" },
      { id: "dismiss", label: "Dismiss", kind: "dismiss" },
      { id: "open_records", label: "Open supporting records", kind: "open_record" },
    ]),
  }));

  return deepFreeze({
    businessId,
    generatedAt: new Date().toISOString(),
    openCount: cards.length,
    candidates: cards,
    history: all
      .filter((entry) => !isOpenIntelligenceCandidate(entry))
      .map((entry) => deepFreeze({
        id: entry.id,
        status: entry.status,
        title: entry.title,
        dismissalReason: entry.dismissalReason,
        resolvedAt: entry.resolvedAt,
        convertedWorkId: entry.convertedWorkId,
        architectSessionId: entry.architectSessionId,
      })),
  });
}

export function intelligenceCandidateToAttentionItem(candidate) {
  return deepFreeze({
    id: `attention_intelligence_${candidate.id}`,
    title: candidate.title,
    summary: candidate.summary,
    reason: candidate.confidenceReason,
    businessImpact: candidate.explanation,
    priority: candidate.severity === "critical" ? "critical"
      : candidate.severity === "high" ? "high"
        : "medium",
    dueAt: null,
    waitingDuration: null,
    sourceType: "intelligence_candidate",
    sourceId: candidate.id,
    intelligenceCandidateId: candidate.id,
    partyId: candidate.relatedObjectRefs?.find((ref) => ref.objectType === "party")?.objectId ?? null,
    partyName: null,
    subjectName: null,
    recommendedAction: candidate.recommendedActions?.[0]?.label ?? "Review evidence and decide.",
    availableActions: [
      { id: "create_work", label: "Create Work", kind: "create_work" },
      { id: "propose_change", label: "Propose Change", kind: "create_architect_change_proposal" },
      { id: "ask_architect", label: "Ask Architect", kind: "ask_architect" },
      { id: "dismiss", label: "Dismiss", kind: "dismiss" },
    ],
    relatedObjects: (candidate.relatedObjectRefs ?? []).map((ref) => ({
      entityType: ref.objectType,
      entityId: ref.objectId,
    })),
    evidence: candidate.evidence,
    confidenceReason: candidate.confidenceReason,
    explanation: candidate.explanation,
  });
}
