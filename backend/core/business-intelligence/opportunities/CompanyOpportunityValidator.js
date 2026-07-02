import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_EFFORT,
  OPPORTUNITY_IMPACT,
  OPPORTUNITY_PRIORITY,
} from "./CompanyOpportunityDefaults.js";

function fail(message) {
  throw new Error(`CompanyOpportunityValidator: ${message}`);
}

function uniqueById(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function isDeepFrozen(v) {
  return typeof v === "object" ? Object.isFrozen(v) : false;
}

export function validateCompanyOpportunities(opps) {
  if (!opps || typeof opps !== "object") fail("opportunities required.");

  const requiredTop = [
    "opportunitiesId",
    "companyId",
    "generatedAt",
    "summary",
    "overallPotential",
    "opportunities",
    "quickWins",
    "strategicInvestments",
    "recommendedOrder",
    "metadata",
  ];
  for (const k of requiredTop) {
    if (!(k in opps)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(opps.opportunities)) fail("opportunities must be array.");
  if (!Array.isArray(opps.quickWins)) fail("quickWins must be array.");
  if (!Array.isArray(opps.strategicInvestments)) fail("strategicInvestments must be array.");
  if (!Array.isArray(opps.recommendedOrder)) fail("recommendedOrder must be array.");

  uniqueById(opps.opportunities, "opportunity");
  uniqueById(opps.quickWins, "quickWin");
  uniqueById(opps.strategicInvestments, "strategicInvestments");

  for (const o of opps.opportunities) {
    if (!o || typeof o !== "object") fail("opportunity entry must be object.");
    if (!o.id || typeof o.id !== "string") fail("opportunity.id required.");
    if (!o.title || typeof o.title !== "string") fail("opportunity.title required.");
    if (!o.summary || typeof o.summary !== "string") fail("opportunity.summary required.");
    if (!OPPORTUNITY_CATEGORIES.includes(o.category)) fail(`invalid category: ${o.category}`);
    if (!OPPORTUNITY_PRIORITY.includes(o.priority)) fail(`invalid priority: ${o.priority}`);
    if (!OPPORTUNITY_IMPACT.includes(o.impact)) fail(`invalid impact: ${o.impact}`);
    if (!OPPORTUNITY_EFFORT.includes(o.effort)) fail(`invalid effort: ${o.effort}`);
    if (!o.estimatedValue || typeof o.estimatedValue !== "string") fail("estimatedValue required.");
    if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) fail("confidence must be 0..1.");
    if (!o.reason || typeof o.reason !== "string") fail("reason required.");
    if (!o.recommendedAction || typeof o.recommendedAction !== "object") fail("recommendedAction required.");
    if (!Array.isArray(o.dependencies)) fail("dependencies must be array.");
    if (!isDeepFrozen(o)) fail("opportunity must be deep frozen.");
  }

  // recommendedOrder must match opportunity ids (subset/order).
  const ids = new Set(opps.opportunities.map((x) => x.id));
  const seenOrder = new Set();
  for (const id of opps.recommendedOrder) {
    const s = String(id);
    if (!ids.has(s)) fail(`recommendedOrder includes missing opportunity id: ${s}`);
    if (seenOrder.has(s)) fail(`recommendedOrder duplicates: ${s}`);
    seenOrder.add(s);
  }

  if (!Object.isFrozen(opps)) fail("opportunities must be deep frozen.");
  return { ok: true };
}

