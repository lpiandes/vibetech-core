import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { AUTOMATION_CONDITION_OPERATORS } from "../automations/AutomationCondition.js";

/**
 * Serializable segment criteria for parties interested in a canonical subject.
 * Used by audience preview and future campaign execution — same semantics, no drift.
 */
export function buildSubjectInterestSegmentCriteria(subjectId) {
  const sid = String(subjectId ?? "").trim();
  if (!sid) throw new Error("buildSubjectInterestSegmentCriteria: subjectId required.");

  return deepFreeze([
    {
      fieldPath: "subjectIds",
      operator: AUTOMATION_CONDITION_OPERATORS.IN,
      value: [sid],
    },
  ]);
}
