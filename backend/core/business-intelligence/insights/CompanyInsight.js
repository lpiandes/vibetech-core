import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  INSIGHT_CATEGORIES,
  INSIGHT_DIRECTIONS,
  INSIGHT_SEVERITIES,
  INSIGHT_SEVERITY_RANK,
} from "./CompanyInsightDefaults.js";

function fail(message) {
  throw new Error(`CompanyInsight: ${message}`);
}

export function createCompanyInsight({
  id,
  title,
  summary,
  category,
  direction,
  severity,
  confidence,
  before,
  after,
  delta,
  source,
  recommendedAction,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!summary || typeof summary !== "string") fail("summary required.");

  if (!INSIGHT_CATEGORIES.includes(category)) fail(`invalid category: ${category}`);
  if (!INSIGHT_DIRECTIONS.includes(direction)) fail(`invalid direction: ${direction}`);
  if (!INSIGHT_SEVERITIES.includes(severity)) fail(`invalid severity: ${severity}`);

  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    fail("confidence must be a number 0..1.");
  }

  // recommendedAction can be null or an object.
  const insight = {
    id,
    title,
    summary,
    category,
    direction,
    severity,
    confidence,
    before: before ?? null,
    after: after ?? null,
    delta: delta ?? null,
    source: source ?? "health",
    recommendedAction:
      recommendedAction && typeof recommendedAction === "object"
        ? deepFreeze(recommendedAction)
        : null,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  // deepFreeze for immutability.
  return deepFreeze(insight);
}

export function confidenceFromSeverity(severity) {
  const v = INSIGHT_SEVERITY_RANK[String(severity)] ?? 4;
  // Lower rank (critical=0) -> higher confidence. Deterministic mapping.
  return Math.max(0.2, 0.95 - v * 0.12);
}

