/**
 * Universal Portal registries — only registered types may render.
 * Never generate React dynamically. Never invent arbitrary UI types.
 */

export const WIDGET_TYPES = Object.freeze([
  "metric_cards",
  "kpi_cards",
  "attention_queue",
  "recent_activity",
  "work_queue",
  "digital_workforce",
  "subject_summaries",
  "pipeline",
  "calendar_deadlines",
  "communication_summary",
  "charts",
  "reports",
  "readiness",
  "operational_alerts",
]);

export const VIEW_TYPES = Object.freeze([
  "summary",
  "timeline",
  "related_work",
  "notes",
  "files",
  "records_list",
  "work_queue",
  "calendar",
  "form",
  "metrics",
  "setup_card",
  "knowledge_list",
]);

export const MODULE_VIEW_TYPES = Object.freeze([
  "records_list",
  "work_queue",
  "timeline",
  "calendar",
  "form",
  "metrics",
  "setup_card",
  "knowledge_list",
  "communications",
  "team",
  "performance",
  "home",
  "subjects",
  "people",
]);

/** moduleId → registered presentation view (safe, explicit map). */
export const MODULE_PRESENTATION = Object.freeze({
  home: "home",
  for_you: "home",
  work: "work_queue",
  work_queue: "work_queue",
  people: "people",
  engagement: "people",
  properties: "subjects",
  teams: "people",
  players: "people",
  inbox: "communications",
  communications: "communications",
  digital_workforce: "team",
  team: "team",
  knowledge: "knowledge_list",
  performance: "performance",
  reports: "performance",
  analytics: "performance",
  integrations: "setup_card",
  connections: "setup_card",
  settings: "setup_card",
  readiness: "setup_card",
  schedule: "calendar",
  practices: "calendar",
  appointments: "calendar",
  drills: "knowledge_list",
  scouting: "work_queue",
  campaigns: "work_queue",
});

/** Safe primary actions → relative route segments (never arbitrary paths). */
export const ACTION_ROUTE_MAP = Object.freeze({
  review_attention: "for-you",
  open_work: "work",
  approve_work: "work",
  import_crm: "people",
  classify_relationship: "people",
  import_properties: "properties",
  prepare_campaign: "work",
  approve_campaign: "work",
  send_campaign: "work",
  add_knowledge: "knowledge",
  invite_team: "team",
  connect_integration: "integrations",
});

export function isRegisteredWidget(type) {
  return WIDGET_TYPES.includes(String(type));
}

export function isRegisteredView(type) {
  return VIEW_TYPES.includes(String(type));
}

export function isRegisteredModuleView(type) {
  return MODULE_VIEW_TYPES.includes(String(type));
}

export function resolveModulePresentation(moduleId, viewType = null) {
  if (viewType && isRegisteredModuleView(viewType)) {
    return { moduleId: String(moduleId), viewType: String(viewType), allowed: true };
  }
  const mapped = MODULE_PRESENTATION[String(moduleId)] ?? null;
  if (!mapped || !isRegisteredModuleView(mapped)) {
    return { moduleId: String(moduleId), viewType: null, allowed: false };
  }
  return { moduleId: String(moduleId), viewType: mapped, allowed: true };
}

export function resolveActionHref(actionId, businessId) {
  const segment = ACTION_ROUTE_MAP[String(actionId)] ?? null;
  if (!segment || !businessId) return null;
  return `/b/${businessId}/${segment}`;
}

export function listWidgetRegistry() {
  return WIDGET_TYPES.map((type) => ({ type, family: "dashboard_widget" }));
}

export function listViewRegistry() {
  return VIEW_TYPES.map((type) => ({ type, family: "record_view" }));
}

export function listModuleRegistry() {
  return Object.entries(MODULE_PRESENTATION).map(([moduleId, viewType]) => ({
    moduleId,
    viewType,
    family: "module",
  }));
}
