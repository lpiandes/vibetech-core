import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_EFFORT,
  OPPORTUNITY_IMPACT,
  OPPORTUNITY_PRIORITY,
} from "./CompanyOpportunityDefaults.js";

// Note: OPPORTUNITY_EFFORT/IMPACT/Priority are exported as const arrays.

function fail(message) {
  throw new Error(`CompanyOpportunity: ${message}`);
}

export function createCompanyOpportunity({
  id,
  title,
  summary,
  category,
  priority,
  impact,
  effort,
  estimatedValue,
  confidence,
  reason,
  recommendedAction,
  dependencies,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!category || typeof category !== "string") fail("category required.");
  if (!OPPORTUNITY_CATEGORIES.includes(category)) fail(`invalid category: ${category}`);

  const pr = String(priority ?? "");
  if (!OPPORTUNITY_PRIORITY.includes(pr)) fail(`invalid priority: ${pr}`);
  const im = String(impact ?? "");
  if (!OPPORTUNITY_IMPACT.includes(im)) fail(`invalid impact: ${im}`);
  const ef = String(effort ?? "");
  if (!OPPORTUNITY_EFFORT.includes(ef)) fail(`invalid effort: ${ef}`);

  if (!estimatedValue || typeof estimatedValue !== "string") fail("estimatedValue required.");

  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) fail("confidence must be 0..1.");
  if (!reason || typeof reason !== "string") fail("reason required.");

  const actionOk = Boolean(recommendedAction) && typeof recommendedAction === "object";
  if (!actionOk) fail("recommendedAction required.");

  const deps = Array.isArray(dependencies) ? dependencies.map(String) : [];

  const opp = {
    id,
    title,
    summary,
    category,
    priority: pr,
    impact: im,
    effort: ef,
    estimatedValue,
    confidence,
    reason,
    recommendedAction: deepFreeze(recommendedAction),
    dependencies: deepFreeze(deps),
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(opp);
}

