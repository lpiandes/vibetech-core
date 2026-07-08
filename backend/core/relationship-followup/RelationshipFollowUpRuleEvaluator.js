import { addDaysISO, daysSince } from "./RelationshipFollowUpEvidence.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function conditionMatchesDecisionTimeline(condition, value) {
  if (!condition) return true;
  if (condition.equals !== undefined) return String(value ?? "") === String(condition.equals);
  if (Array.isArray(condition.oneOf)) return condition.oneOf.map(String).includes(String(value ?? ""));
  return true;
}

function qualificationIncomplete(evidence) {
  const completeness = evidence.qualificationCompleteness ?? {};
  return !completeness.hasIntent || !completeness.hasDecisionTimeline || !completeness.hasContactMethod;
}

export function evaluateRelationshipFollowUpRule({ rule, evidence, nowISO } = {}) {
  if (!isPlainObject(rule)) return { matched: false, reason: "missing_rule" };
  if (!isPlainObject(evidence)) return { matched: false, reason: "missing_evidence" };

  if (String(evidence.relationship?.status ?? "") !== "active") {
    return { matched: false, reason: "relationship_not_active" };
  }

  const recurrenceDays = Number(rule.recurrenceDays ?? 0);
  const futureFollowUpAt = evidence.latestFutureFollowUpCommitment?.followUpAt ?? null;
  if (futureFollowUpAt) {
    return { matched: false, reason: "future_follow_up_scheduled", recurrenceBlockedUntil: futureFollowUpAt };
  }

  const completedAt = evidence.latestCompletedMatchingWork?.completedAt ?? null;
  const recurrenceBlockedUntil = completedAt ? addDaysISO(completedAt, recurrenceDays) : null;
  const recurrenceAge = completedAt ? daysSince(completedAt, nowISO) : null;
  if (completedAt && recurrenceAge !== null && recurrenceAge < recurrenceDays) {
    return { matched: false, reason: "recurrence_blocked", recurrenceBlockedUntil };
  }

  const staleAfterDays = Number(rule.staleAfterDays ?? rule.recurrenceDays ?? 0);
  const activityAge = evidence.latestMeaningfulActivityAt ? daysSince(evidence.latestMeaningfulActivityAt, nowISO) : null;
  if (activityAge !== null && activityAge <= staleAfterDays) {
    return { matched: false, reason: "activity_not_stale" };
  }

  const conditions = isPlainObject(rule.conditions) ? rule.conditions : {};
  if (!conditionMatchesDecisionTimeline(conditions.decisionTimeline, evidence.qualification?.decisionTimeline)) {
    return { matched: false, reason: "decision_timeline_not_matched" };
  }
  if (conditions.requiresPropertyInterest && !evidence.propertyInterest) {
    return { matched: false, reason: "property_interest_missing" };
  }
  if (conditions.requiresIncompleteQualification && !qualificationIncomplete(evidence)) {
    return { matched: false, reason: "qualification_complete" };
  }

  return {
    matched: true,
    recurrenceBlockedUntil,
    evidence: {
      relationship: evidence.relationship,
      qualification: evidence.qualification,
      qualificationCompleteness: evidence.qualificationCompleteness,
      propertyInterest: evidence.propertyInterest,
      latestMeaningfulActivityAt: evidence.latestMeaningfulActivityAt,
      latestFutureFollowUpCommitment: evidence.latestFutureFollowUpCommitment,
      importedNotes: safeArray(evidence.importedNotes),
    },
  };
}
