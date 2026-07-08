import { evaluateAutomationCondition } from "../automations/engine/AutomationConditionEvaluator.js";

/**
 * Evaluates segment criteria against a record using the automation condition evaluator.
 */
export function evaluateSegmentCriteria({ criteria, record } = {}) {
  const conditions = Array.isArray(criteria) ? criteria : [];
  for (const condition of conditions) {
    const matched = evaluateAutomationCondition({ condition, event: record });
    if (!matched) return false;
  }
  return conditions.length > 0;
}

export function buildSegmentMatchExplanation({ criteria, record } = {}) {
  const conditions = Array.isArray(criteria) ? criteria : [];
  const explanations = [];
  for (const condition of conditions) {
    const matched = evaluateAutomationCondition({ condition, event: record });
    explanations.push({
      fieldPath: condition.fieldPath,
      operator: condition.operator,
      matched,
    });
  }
  return explanations;
}
