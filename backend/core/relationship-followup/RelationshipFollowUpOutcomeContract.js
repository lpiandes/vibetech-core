import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export const RELATIONSHIP_FOLLOW_UP_OUTCOME_IDS = deepFreeze([
  "reached_still_interested",
  "no_response",
  "not_interested",
  "qualification_updated",
  "showing_requested",
  "follow_up_later",
]);

export function findRelationshipFollowUpOutcome({ outcomes, outcomeId } = {}) {
  const id = String(outcomeId ?? "");
  return safeArray(outcomes).find((outcome) => String(outcome?.id) === id) ?? null;
}

export function validateRelationshipFollowUpOutcomeSelection({
  outcomes,
  outcomeId,
  relationshipType,
  note,
  nextFollowUpAt,
  qualificationUpdates,
} = {}) {
  const errors = [];
  const outcome = findRelationshipFollowUpOutcome({ outcomes, outcomeId });
  if (!outcome) errors.push("Unsupported relationship follow-up outcome.");

  if (outcome && !safeArray(outcome.applicableRelationshipTypes).map(String).includes(String(relationshipType))) {
    errors.push("Outcome is not applicable to this relationship type.");
  }

  const trimmedNote = String(note ?? "").trim();
  if (outcome?.requiresNote && !trimmedNote) errors.push("Note is required for this outcome.");
  if (outcome && outcome.allowsNote === false && trimmedNote) errors.push("Note is not allowed for this outcome.");

  if (outcome?.requiresNextFollowUpAt && !nextFollowUpAt) {
    errors.push("Next follow-up date is required for this outcome.");
  }
  if (nextFollowUpAt) {
    const ms = new Date(String(nextFollowUpAt)).getTime();
    if (!Number.isFinite(ms)) errors.push("Next follow-up date must be a valid ISO date.");
  }

  if (qualificationUpdates !== undefined && qualificationUpdates !== null) {
    if (!isPlainObject(qualificationUpdates)) errors.push("Qualification updates must be an object.");
    if (outcome && !outcome.allowsQualificationUpdates && Object.keys(qualificationUpdates).length > 0) {
      errors.push("Qualification updates are not allowed for this outcome.");
    }
  }

  return deepFreeze({
    ok: errors.length === 0,
    outcome: outcome ? deepFreeze(outcome) : null,
    errors: deepFreeze(errors),
  });
}

export function outcomeCountsAsMeaningfulCustomerActivity(outcome) {
  return Boolean(outcome?.activitySemantics?.meaningfulCustomerActivity);
}
