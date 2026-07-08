import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const AUTOMATION_CONDITION_OPERATORS = {
  EQUALS: "EQUALS",
  NOT_EQUALS: "NOT_EQUALS",
  EXISTS: "EXISTS",
  NOT_EXISTS: "NOT_EXISTS",
  IN: "IN",
  NOT_IN: "NOT_IN",
  GREATER_THAN: "GREATER_THAN",
  GREATER_THAN_OR_EQUAL: "GREATER_THAN_OR_EQUAL",
  LESS_THAN: "LESS_THAN",
  LESS_THAN_OR_EQUAL: "LESS_THAN_OR_EQUAL",
};

function fail(message) {
  throw new Error(`AutomationCondition: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

export function createAutomationCondition({ fieldPath, operator, value } = {}) {
  requireString(fieldPath, "fieldPath");
  requireString(operator, "operator");

  const op = String(operator);
  if (!Object.values(AUTOMATION_CONDITION_OPERATORS).includes(op)) {
    fail(`operator must be one of: ${Object.values(AUTOMATION_CONDITION_OPERATORS).join(", ")}`);
  }

  const safeValue =
    op === AUTOMATION_CONDITION_OPERATORS.EXISTS || op === AUTOMATION_CONDITION_OPERATORS.NOT_EXISTS ? null : value;

  return deepFreeze({
    fieldPath: String(fieldPath),
    operator: op,
    value: safeValue === undefined ? null : safeValue,
  });
}
