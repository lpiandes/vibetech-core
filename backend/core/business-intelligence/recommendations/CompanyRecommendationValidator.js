import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_EFFORT,
  RECOMMENDATION_IMPACT,
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_STATUSES,
} from "./CompanyRecommendationDefaults.js";

function fail(message) {
  throw new Error(`CompanyRecommendationValidator: ${message}`);
}

function uniqueById(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateCompanyRecommendations(recs) {
  if (!recs || typeof recs !== "object") fail("recommendations required.");

  const requiredTop = [
    "recommendationsId",
    "companyId",
    "generatedAt",
    "summary",
    "recommendations",
    "topRecommendation",
    "immediateActions",
    "nextActions",
    "laterActions",
    "metadata",
  ];
  for (const k of requiredTop) {
    if (!(k in recs)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(recs.recommendations)) fail("recommendations must be array.");
  if (!Array.isArray(recs.immediateActions)) fail("immediateActions must be array.");
  if (!Array.isArray(recs.nextActions)) fail("nextActions must be array.");
  if (!Array.isArray(recs.laterActions)) fail("laterActions must be array.");
  if (!recs.topRecommendation || typeof recs.topRecommendation !== "object") fail("topRecommendation must be object.");

  uniqueById(recs.recommendations, "recommendation");

  const recIdSet = new Set(recs.recommendations.map((r) => String(r.id)));

  const allGroup = [...recs.immediateActions, ...recs.nextActions, ...recs.laterActions];
  for (const r of allGroup) {
    if (!recIdSet.has(String(r?.id))) fail(`group contains recommendation not in recommendations: ${r?.id}`);
    if (!r || typeof r !== "object") fail("group item must be object.");
    if (!RECOMMENDATION_PRIORITIES.includes(r.priority)) fail(`invalid recommendation.priority: ${r.priority}`);
  }

  // groups must be disjoint by id.
  const groupIds = allGroup.map((r) => String(r.id));
  const groupSeen = new Set();
  for (const id of groupIds) {
    if (groupSeen.has(id)) fail(`duplicate in groups: ${id}`);
    groupSeen.add(id);
  }

  if (allGroup.length !== recs.recommendations.length) {
    fail("groups must cover all recommendations exactly once.");
  }

  for (const r of recs.recommendations) {
    if (!r || typeof r !== "object") fail("recommendation entry must be object.");
    if (!r.id || typeof r.id !== "string") fail("recommendation.id required.");
    if (!r.title || typeof r.title !== "string") fail("recommendation.title required.");
    if (!r.summary || typeof r.summary !== "string") fail("recommendation.summary required.");
    if (!RECOMMENDATION_CATEGORIES.includes(r.category)) fail(`invalid recommendation.category: ${r.category}`);
    if (!RECOMMENDATION_PRIORITIES.includes(r.priority)) fail(`invalid recommendation.priority: ${r.priority}`);
    if (!RECOMMENDATION_IMPACT.includes(r.impact)) fail(`invalid recommendation.impact: ${r.impact}`);
    if (!RECOMMENDATION_EFFORT.includes(r.effort)) fail(`invalid recommendation.effort: ${r.effort}`);

    if (!r.source || typeof r.source !== "string") fail("recommendation.source required.");
    if (!r.reason || typeof r.reason !== "string") fail("recommendation.reason required.");
    if (!r.action || typeof r.action !== "string") fail("recommendation.action required.");
    if (!r.target || typeof r.target !== "string") fail("recommendation.target required.");

    const deps = r.dependencies;
    if (!Array.isArray(deps)) fail("recommendation.dependencies must be array.");
    for (const d of deps) {
      if (!recIdSet.has(String(d))) fail(`dependency ${d} not present in recommendations.`);
    }

    if (!RECOMMENDATION_STATUSES.includes(r.status)) fail(`invalid recommendation.status: ${r.status}`);

    if (!Object.isFrozen(r)) fail("recommendations must be deep frozen (Object.isFrozen).");
  }

  if (!Object.isFrozen(recs)) fail("recommendations output must be deep frozen (Object.isFrozen).");
  return { ok: true };
}

