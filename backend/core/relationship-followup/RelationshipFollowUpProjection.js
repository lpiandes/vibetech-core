import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

import { buildRelationshipFollowUpEvidence } from "./RelationshipFollowUpEvidence.js";
import { evaluateRelationshipFollowUpRule } from "./RelationshipFollowUpRuleEvaluator.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function priorityRank(priority) {
  switch (String(priority ?? "")) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 9;
  }
}

function activePartyRelationship(partyId, relationship, rule) {
  if (String(relationship?.relationshipType) === "REQUESTED_BY") return false;
  if (String(relationship?.status ?? "") !== "active") return false;
  if (!safeArray(rule?.relationshipTypes).map(String).includes(String(relationship?.relationshipType))) return false;
  const pid = String(partyId);
  return (
    (String(relationship?.fromEntity?.entityType) === "Party" && String(relationship?.fromEntity?.entityId) === pid) ||
    (String(relationship?.toEntity?.entityType) === "Party" && String(relationship?.toEntity?.entityId) === pid)
  );
}

function candidateTargetWork(rule) {
  const target = rule?.targetWork ?? {};
  return {
    workType: String(target.workType ?? "prospect_follow_up"),
    stageId: String(target.stageId ?? "stage_follow_up"),
    queueId: String(target.queueId ?? "queue_follow_up"),
    title: String(target.title ?? "Prospect follow-up"),
    description: String(target.description ?? "Review relationship context and complete follow-up."),
  };
}

export function buildRelationshipFollowUpProjection({
  businessGraphRuntime,
  requestRuntime,
  workRuntime,
  interactionRuntime,
  communicationRuntime,
  businessSubjectRuntime,
  communicationPreferenceRuntime,
  relationshipFollowUpRules,
  relationshipTypes,
  nowISO,
} = {}) {
  const generatedAt = String(nowISO ?? new Date().toISOString());
  const parties = safeArray(businessGraphRuntime?.getParties?.());
  const relationships = safeArray(businessGraphRuntime?.getRelationships?.());
  const rules = safeArray(relationshipFollowUpRules);
  const candidates = [];

  for (const party of parties) {
    const partyId = String(party.id);
    for (const rule of rules) {
      for (const relationship of relationships) {
        if (!activePartyRelationship(partyId, relationship, rule)) continue;
        const evidence = buildRelationshipFollowUpEvidence({
          businessGraphRuntime,
          requestRuntime,
          workRuntime,
          interactionRuntime,
          communicationRuntime,
          businessSubjectRuntime,
          communicationPreferenceRuntime,
          relationshipTypes,
          party,
          relationship,
          rule,
          nowISO: generatedAt,
        });
        const evaluated = evaluateRelationshipFollowUpRule({ rule, evidence, nowISO: generatedAt });
        if (!evaluated.matched) continue;

        const existingOpenWorkId = evidence.existingOpenWork?.id ? String(evidence.existingOpenWork.id) : null;
        const latestCompletedMatchingWorkId = evidence.latestCompletedMatchingWork?.id
          ? String(evidence.latestCompletedMatchingWork.id)
          : null;
        candidates.push({
          candidateId: evidence.candidateId,
          partyId: evidence.partyId,
          displayName: evidence.displayName,
          relationshipType: evidence.relationshipType,
          relationshipLabel: evidence.relationshipLabel,
          ruleId: String(rule.id),
          priority: String(rule.priority),
          reasonCode: String(rule.reasonCode),
          reasonLabel: String(rule.reasonLabel),
          evidence: evaluated.evidence,
          latestMeaningfulActivityAt: evidence.latestMeaningfulActivityAt,
          latestFutureFollowUpCommitment: evidence.latestFutureFollowUpCommitment,
          existingOpenWorkId,
          latestCompletedMatchingWorkId,
          recurrenceBlockedUntil: evaluated.recurrenceBlockedUntil ?? null,
          contactability: evidence.contactability,
          targetWork: candidateTargetWork(rule),
          relatedObjects: evidence.relatedObjects,
        });
      }
    }
  }

  candidates.sort((a, b) => {
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (String(a.displayName) !== String(b.displayName)) return String(a.displayName).localeCompare(String(b.displayName));
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });

  return deepFreeze({
    generatedAt,
    candidates: deepFreeze(candidates.map((candidate) => deepFreeze(candidate))),
  });
}
