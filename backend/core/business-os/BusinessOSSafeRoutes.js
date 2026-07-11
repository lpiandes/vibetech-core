import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Safe registered product routes for Business OS modules.
 * Arbitrary route generation is forbidden — only these destinations may appear in nav.
 */
export const BUSINESS_OS_SAFE_ROUTES = Object.freeze({
  home: "home",
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
  integrations: "integrations",
  connections: "integrations",
  settings: "settings",
  setup: "settings",
  readiness: "readiness",
  // Hockey fixture modules map to safe universal routes (subject/work surfaces).
  teams: "people",
  players: "people",
  schedule: "work",
  practices: "work",
  drills: "knowledge",
  scouting: "work",
});

export function resolveSafeModuleHref(moduleId, { businessId = null } = {}) {
  const segment = BUSINESS_OS_SAFE_ROUTES[String(moduleId)] ?? null;
  if (!segment) return null;
  if (!businessId) return `/${segment}`;
  return `/b/${businessId}/${segment}`;
}

export function isSafeModuleRoute(moduleId) {
  return Object.prototype.hasOwnProperty.call(BUSINESS_OS_SAFE_ROUTES, String(moduleId));
}

export function listSafeModuleIds() {
  return deepFreeze(Object.keys(BUSINESS_OS_SAFE_ROUTES));
}
