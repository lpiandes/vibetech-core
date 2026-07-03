import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`AnalyticsInsight: ${message}`);
}

export function createAnalyticsInsight({
  insightId,
  category,
  title,
  message,
  evidence,
} = {}) {
  if (!insightId) fail("insightId required.");
  if (!category) fail("category required.");
  if (!title) fail("title required.");
  if (!message) fail("message required.");
  const ins = {
    insightId: String(insightId),
    category: String(category),
    title: String(title),
    message: String(message),
    evidence: Array.isArray(evidence) ? deepFreeze(evidence.map((x) => String(x))) : deepFreeze([]),
  };
  return deepFreeze(ins);
}

