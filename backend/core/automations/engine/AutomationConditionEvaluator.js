import { AUTOMATION_CONDITION_OPERATORS } from "../AutomationCondition.js";

function fail(message) {
  throw new Error(`AutomationConditionEvaluator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function validateFieldPath(fieldPath) {
  // Deterministic nested path: segments must be safe tokens.
  requireString(fieldPath, "fieldPath");
  const ok = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/.test(String(fieldPath));
  if (!ok) fail(`Invalid fieldPath: ${String(fieldPath)}`);
  return String(fieldPath);
}

function getByFieldPath(root, fieldPath) {
  const fp = validateFieldPath(fieldPath);
  const parts = fp.split(".");
  let cur = root;
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function toStringSafe(v) {
  if (v === undefined || v === null) return "";
  return String(v);
}

function toArray(v) {
  return Array.isArray(v) ? v : [v];
}

export function evaluateAutomationCondition({ condition, event } = {}) {
  if (!condition || typeof condition !== "object") fail("condition required.");
  if (!event || typeof event !== "object") fail("event required.");

  const fieldPath = String(condition.fieldPath ?? "");
  const operator = String(condition.operator ?? "");
  const expected = condition.value;

  const actual = getByFieldPath(event, fieldPath);

  const op = operator;
  if (!Object.values(AUTOMATION_CONDITION_OPERATORS).includes(op)) {
    fail(`Unsupported operator: ${String(operator)}`);
  }

  switch (op) {
    case AUTOMATION_CONDITION_OPERATORS.EXISTS:
      return actual !== undefined && actual !== null;
    case AUTOMATION_CONDITION_OPERATORS.NOT_EXISTS:
      return actual === undefined || actual === null;

    case AUTOMATION_CONDITION_OPERATORS.EQUALS: {
      const expectedStr = toStringSafe(expected);
      const arr = toArray(actual);
      return arr.some((x) => toStringSafe(x) === expectedStr);
    }

    case AUTOMATION_CONDITION_OPERATORS.NOT_EQUALS: {
      const expectedStr = toStringSafe(expected);
      const arr = toArray(actual);
      return arr.every((x) => toStringSafe(x) !== expectedStr);
    }

    case AUTOMATION_CONDITION_OPERATORS.IN: {
      if (!Array.isArray(expected)) fail("IN expects condition.value to be an array.");
      const expectedSet = new Set(expected.map((x) => toStringSafe(x)));
      const arr = toArray(actual);
      return arr.some((x) => expectedSet.has(toStringSafe(x)));
    }

    case AUTOMATION_CONDITION_OPERATORS.NOT_IN: {
      if (!Array.isArray(expected)) fail("NOT_IN expects condition.value to be an array.");
      const expectedSet = new Set(expected.map((x) => toStringSafe(x)));
      const arr = toArray(actual);
      return arr.every((x) => !expectedSet.has(toStringSafe(x)));
    }

    case AUTOMATION_CONDITION_OPERATORS.GREATER_THAN:
    case AUTOMATION_CONDITION_OPERATORS.GREATER_THAN_OR_EQUAL:
    case AUTOMATION_CONDITION_OPERATORS.LESS_THAN:
    case AUTOMATION_CONDITION_OPERATORS.LESS_THAN_OR_EQUAL: {
      const a = Number(actual);
      const b = Number(expected);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (op === AUTOMATION_CONDITION_OPERATORS.GREATER_THAN) return a > b;
      if (op === AUTOMATION_CONDITION_OPERATORS.GREATER_THAN_OR_EQUAL) return a >= b;
      if (op === AUTOMATION_CONDITION_OPERATORS.LESS_THAN) return a < b;
      if (op === AUTOMATION_CONDITION_OPERATORS.LESS_THAN_OR_EQUAL) return a <= b;
      return false;
    }

    default:
      fail(`Unhandled operator: ${String(op)}`);
  }
}
