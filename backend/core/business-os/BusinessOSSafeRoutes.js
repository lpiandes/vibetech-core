import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isSpecialtySurfaceModuleId } from "../ai-builder/specialty/SpecialtySurfaceCompiler.js";

/**
 * Safe registered product routes for Business OS modules.
 * Arbitrary route generation is forbidden — only these destinations may appear in nav.
 * Specialty surfaces use a single hosted route: /specialty/{surfaceId}.
 */
export const BUSINESS_OS_SAFE_ROUTES = Object.freeze({
  home: "home",
  mission_control: "mission-control",
  for_you: "for-you",
  work: "work",
  work_queue: "work",
  people: "people",
  engagement: "people",
  properties: "properties",
  inbox: "inbox",
  communications: "inbox",
  campaigns: "work", // campaign studio lives under Work until a dedicated safe route exists
  team: "team",
  digital_workforce: "team",
  knowledge: "knowledge",
  performance: "performance",
  analytics: "performance",
  reports: "performance",
  intelligence: "intelligence",
  business_intelligence: "intelligence",
  integrations: "integrations",
  connections: "integrations",
  settings: "settings",
  setup: "settings",
  readiness: "readiness",
  appointments: "work",
  treatment_plans: "people",
  billing: "performance",
  referrals: "people",
  // Hockey fixture modules map to safe universal routes (subject/work surfaces).
  teams: "people",
  players: "people",
  schedule: "work",
  practices: "work",
  drills: "knowledge",
  scouting: "work",
});

function specialtySegment(moduleId) {
  return `specialty/${encodeURIComponent(String(moduleId))}`;
}

export function resolveSafeModuleHref(moduleId, { businessId = null } = {}) {
  const id = String(moduleId ?? "");
  let segment = BUSINESS_OS_SAFE_ROUTES[id] ?? null;
  if (!segment && isSpecialtySurfaceModuleId(id)) {
    segment = specialtySegment(id);
  }
  if (!segment) return null;
  if (!businessId) return `/${segment}`;
  return `/b/${businessId}/${segment}`;
}

export function isSafeModuleRoute(moduleId) {
  const id = String(moduleId ?? "");
  if (Object.prototype.hasOwnProperty.call(BUSINESS_OS_SAFE_ROUTES, id)) return true;
  return isSpecialtySurfaceModuleId(id);
}

export function listSafeModuleIds() {
  return deepFreeze(Object.keys(BUSINESS_OS_SAFE_ROUTES));
}
