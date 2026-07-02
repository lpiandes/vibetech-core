import { SECTION_IDS, SECTION_ORDER } from "./CompanyBriefDefaults.js";

function fail(message) {
  throw new Error(`CompanyBriefValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function requireArray(v, name) {
  if (!Array.isArray(v)) fail(`${name} must be an array.`);
}

function requireString(v, name) {
  if (typeof v !== "string") fail(`${name} must be a string.`);
}

function validateUniqueById(arr, label) {
  const ids = arr.map((x) => x?.id).filter(Boolean).map(String);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

export function validateCompanyBrief(brief) {
  if (!brief || typeof brief !== "object") fail("brief required.");

  requireString(brief.briefId, "briefId");
  requireString(brief.companyId, "companyId");
  requireString(brief.generatedAt, "generatedAt");
  requireString(brief.greeting, "greeting");
  requireString(brief.summary, "summary");
  requireString(brief.overallStatus, "overallStatus");

  if (!Array.isArray(brief.sections)) fail("sections must be an array.");
  if (brief.sections.length === 0) fail("sections must not be empty.");

  requireArray(brief.priorities, "priorities");
  requireArray(brief.decisionsWaiting, "decisionsWaiting");
  requireArray(brief.risks, "risks");
  requireArray(brief.opportunities, "opportunities");
  requireArray(brief.recommendedActions, "recommendedActions");

  // Validate required sections existence.
  const sectionIds = brief.sections.map((s) => s?.id).filter(Boolean).map(String);
  for (const id of SECTION_ORDER) {
    if (!sectionIds.includes(id)) fail(`missing required section: ${id}`);
  }

  // Ensure no duplicate section ids.
  const seenSections = new Set();
  for (const id of sectionIds) {
    if (seenSections.has(id)) fail(`duplicate section id: ${id}`);
    seenSections.add(id);
  }

  // Basic per-action schema checks.
  for (const a of brief.recommendedActions) {
    if (!a || typeof a !== "object") fail("recommendedActions entries must be objects.");
    requireString(a.id, "action.id");
    requireString(a.label, "action.label");
    requireString(a.type, "action.type");
    requireString(a.target, "action.target");
    requireString(a.priority, "action.priority");
    if (!isPlainObject(a.metadata)) fail("action.metadata must be an object.");
  }

  validateUniqueById(brief.recommendedActions, "recommendedActions");
  validateUniqueById(brief.risks, "risks");
  validateUniqueById(brief.opportunities, "opportunities");

  // DecisionsWaiting can be a list of action ids or objects.
  for (const d of brief.decisionsWaiting) {
    if (!d) fail("decisionsWaiting entries must be truthy.");
    if (typeof d === "string") requireString(d, "decisionsWaiting string");
    else if (isPlainObject(d)) {
      requireString(d.id, "decision.id");
    } else {
      fail("decisionsWaiting entries must be string or object.");
    }
  }

  // Ensure deterministic immutability assumptions.
  if (!Object.isFrozen(brief)) fail("brief must be deep-frozen (Object.isFrozen).");

  return { ok: true };
}

export const requiredCompanyBriefSections = new Set(Object.values(SECTION_IDS));

