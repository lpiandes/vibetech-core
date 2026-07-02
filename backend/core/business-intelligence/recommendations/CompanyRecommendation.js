import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_EFFORT,
  RECOMMENDATION_IMPACT,
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_STATUSES,
} from "./CompanyRecommendationDefaults.js";

function fail(message) {
  throw new Error(`CompanyRecommendation: ${message}`);
}

export function createCompanyRecommendation({
  id,
  title,
  summary,
  category,
  priority,
  impact,
  effort,
  source,
  reason,
  action,
  target,
  dependencies,
  status,
  metadata,
} = {}) {
  if (!id || typeof id !== "string") fail("id required.");
  if (!title || typeof title !== "string") fail("title required.");
  if (!summary || typeof summary !== "string") fail("summary required.");
  if (!category || typeof category !== "string") fail("category required.");
  if (!RECOMMENDATION_CATEGORIES.includes(category)) fail(`invalid category: ${category}`);

  const pr = String(priority ?? "");
  if (!RECOMMENDATION_PRIORITIES.includes(pr)) fail(`invalid priority: ${pr}`);

  const im = String(impact ?? "");
  if (!RECOMMENDATION_IMPACT.includes(im)) fail(`invalid impact: ${im}`);

  const ef = String(effort ?? "");
  if (!RECOMMENDATION_EFFORT.includes(ef)) fail(`invalid effort: ${ef}`);

  if (!source || typeof source !== "string") fail("source required.");
  if (!reason || typeof reason !== "string") fail("reason required.");

  if (!action || typeof action !== "string") fail("action required.");
  if (!target || typeof target !== "string") fail("target required.");

  const deps = Array.isArray(dependencies) ? dependencies.map(String) : [];

  const st = String(status ?? "");
  if (!RECOMMENDATION_STATUSES.includes(st)) fail(`invalid status: ${st}`);

  const rec = {
    id,
    title,
    summary,
    category,
    priority: pr,
    impact: im,
    effort: ef,
    source,
    reason,
    action,
    target,
    dependencies: deepFreeze(deps),
    status: st,
    metadata: metadata && typeof metadata === "object" ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(rec);
}

