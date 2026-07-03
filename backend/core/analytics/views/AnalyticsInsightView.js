import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { INSIGHT_IMPORTANCE_ALLOWED } from "./AnalyticsViewDefaults.js";

function fail(message) {
  throw new Error(`AnalyticsInsightView: ${message}`);
}

export function createAnalyticsInsightView({
  insightId,
  category,
  title,
  message,
  importance,
  evidence,
  metadata,
} = {}) {
  if (!insightId) fail("insightId required.");
  if (!category) fail("category required.");
  if (!title) fail("title required.");
  if (!message) fail("message required.");
  const imp = String(importance ?? "");
  if (!INSIGHT_IMPORTANCE_ALLOWED.includes(imp)) fail(`importance invalid: ${imp}`);

  const view = {
    insightId: String(insightId),
    category: String(category),
    title: String(title),
    message: String(message),
    importance: imp,
    evidence: Array.isArray(evidence) ? deepFreeze(evidence.map((x) => String(x))) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

