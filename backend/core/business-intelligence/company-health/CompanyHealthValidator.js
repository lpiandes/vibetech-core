import { HEALTH_DIMENSIONS, HEALTH_STATUS } from "./CompanyHealthDefaults.js";
import { createCompanyHealthDimension } from "./CompanyHealthDimension.js";

function fail(message) {
  throw new Error(`CompanyHealthValidator: ${message}`);
}

function isFrozenObject(v) {
  return Boolean(v) && (Object.isFrozen(v) || typeof v !== "object");
}

function isValidStatus(s) {
  return Object.values(HEALTH_STATUS).includes(s);
}

function isValidTrend(t) {
  return typeof t === "string" && ["UP", "DOWN", "STABLE", "UNKNOWN"].includes(t);
}

function validateUniqueById(arr, label) {
  const ids = (arr ?? []).map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateCompanyHealth(health) {
  if (!health || typeof health !== "object") fail("health required.");

  const requiredTop = [
    "healthId",
    "companyId",
    "generatedAt",
    "overallScore",
    "overallStatus",
    "overallTrend",
    "overallConfidence",
    "dimensions",
    "strengths",
    "risks",
    "recommendations",
    "summary",
  ];
  for (const k of requiredTop) {
    if (!(k in health)) fail(`missing field: ${k}`);
  }

  if (!Array.isArray(health.dimensions)) fail("dimensions must be array.");
  if (!Array.isArray(health.strengths)) fail("strengths must be array.");
  if (!Array.isArray(health.risks)) fail("risks must be array.");
  if (!Array.isArray(health.recommendations)) fail("recommendations must be array.");

  if (typeof health.overallScore !== "number") fail("overallScore must be number.");
  if (health.overallScore < 0 || health.overallScore > 100) fail("overallScore out of range.");
  if (!isValidStatus(health.overallStatus)) fail("overallStatus invalid.");
  if (!isValidTrend(health.overallTrend)) fail("overallTrend invalid.");
  if (typeof health.overallConfidence !== "number") fail("overallConfidence must be number.");
  if (!health.summary || typeof health.summary !== "string") fail("summary missing/invalid.");

  // Duplicate dimensions check and required ids.
  validateUniqueById(health.dimensions, "dimension");

  const dimIds = health.dimensions.map((d) => d?.id).filter(Boolean).map(String);
  for (const required of HEALTH_DIMENSIONS) {
    if (!dimIds.includes(required)) fail(`missing required dimension: ${required}`);
  }

  // Validate each dimension object schema deterministically.
  for (const d of health.dimensions) {
    if (!d || typeof d !== "object") fail("dimension must be object.");
    if (!d.id || typeof d.id !== "string") fail("dimension.id invalid.");
    if (!d.title || typeof d.title !== "string") fail("dimension.title invalid.");
    if (typeof d.score !== "number") fail("dimension.score must be number.");
    if (d.score < 0 || d.score > 100) fail("dimension.score out of range.");
    if (!isValidStatus(d.status)) fail(`dimension.status invalid for ${d.id}`);
    if (!isValidTrend(d.trend)) fail(`dimension.trend invalid for ${d.id}`);
    if (typeof d.confidence !== "number") fail(`dimension.confidence invalid for ${d.id}`);
    if (!d.summary || typeof d.summary !== "string") fail(`dimension.summary missing for ${d.id}`);
    if (!Array.isArray(d.recommendations)) fail(`dimension.recommendations invalid for ${d.id}`);
    if (!isFrozenObject(d)) fail(`dimension ${d.id} must be frozen`);
  }

  validateUniqueById(health.recommendations, "recommendation");
  for (const a of health.recommendations) {
    if (!a?.id || typeof a.id !== "string") fail("recommendation.id invalid.");
    if (!a.label || typeof a.label !== "string") fail("recommendation.label invalid.");
    if (!a.type || typeof a.type !== "string") fail("recommendation.type invalid.");
    if (!a.target || typeof a.target !== "string") fail("recommendation.target invalid.");
    if (!["HIGH", "MEDIUM", "LOW"].includes(String(a.priority))) fail("recommendation.priority invalid.");
    if (!a.metadata || typeof a.metadata !== "object") fail("recommendation.metadata missing.");
  }

  // Strengths/risk objects can be minimal but must be frozen and have ids.
  validateUniqueById(health.strengths, "strength");
  validateUniqueById(health.risks, "risk");
  for (const s of health.strengths) {
    if (!s?.id || typeof s.id !== "string") fail("strength.id invalid.");
    if (!s.label || typeof s.label !== "string") fail("strength.label invalid.");
    if (!s.summary || typeof s.summary !== "string") fail("strength.summary invalid.");
  }
  for (const r of health.risks) {
    if (!r?.id || typeof r.id !== "string") fail("risk.id invalid.");
    if (!r.label || typeof r.label !== "string") fail("risk.label invalid.");
    if (!r.summary || typeof r.summary !== "string") fail("risk.summary invalid.");
  }

  if (!Object.isFrozen(health)) fail("health must be deep frozen.");

  return { ok: true };
}

