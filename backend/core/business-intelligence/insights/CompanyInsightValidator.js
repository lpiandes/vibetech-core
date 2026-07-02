import { INSIGHT_CATEGORIES, INSIGHT_DIRECTIONS, INSIGHT_SEVERITIES } from "./CompanyInsightDefaults.js";

function fail(message) {
  throw new Error(`CompanyInsightValidator: ${message}`);
}

function uniqueById(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateCompanyInsights(insights) {
  if (!insights || typeof insights !== "object") fail("insights required.");
  const requiredTop = [
    "insightsId",
    "companyId",
    "generatedAt",
    "comparisonWindow",
    "summary",
    "insights",
    "notableChanges",
    "positiveChanges",
    "negativeChanges",
    "neutralChanges",
    "recommendedAttention",
    "metadata",
  ];
  for (const k of requiredTop) {
    if (!(k in insights)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(insights.insights)) fail("insights.insights must be array.");
  if (!Array.isArray(insights.notableChanges)) fail("notableChanges must be array.");
  if (!Array.isArray(insights.positiveChanges)) fail("positiveChanges must be array.");
  if (!Array.isArray(insights.negativeChanges)) fail("negativeChanges must be array.");
  if (!Array.isArray(insights.neutralChanges)) fail("neutralChanges must be array.");
  if (!Array.isArray(insights.recommendedAttention)) fail("recommendedAttention must be array.");

  uniqueById(insights.insights, "insight");

  // Validate each insight object.
  for (const i of insights.insights) {
    if (!i || typeof i !== "object") fail("insight entry must be object.");
    if (!i.id || typeof i.id !== "string") fail("insight.id invalid.");
    if (!i.title || typeof i.title !== "string") fail("insight.title invalid.");
    if (!i.summary || typeof i.summary !== "string") fail("insight.summary invalid.");
    if (!INSIGHT_CATEGORIES.includes(i.category)) fail(`insight.category invalid: ${i.category}`);
    if (!INSIGHT_DIRECTIONS.includes(i.direction)) fail(`insight.direction invalid: ${i.direction}`);
    if (!INSIGHT_SEVERITIES.includes(i.severity)) fail(`insight.severity invalid: ${i.severity}`);
    if (typeof i.confidence !== "number") fail("insight.confidence invalid.");
  }

  if (!Object.isFrozen(insights)) fail("insights must be deep frozen (Object.isFrozen).");
  return { ok: true };
}

