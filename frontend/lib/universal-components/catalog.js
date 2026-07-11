/**
 * Universal Component Library catalog.
 * Architect may only assemble portals from these registered types.
 * Industry-specific React is forbidden — terminology/labels customize presentation.
 */

export const UNIVERSAL_COMPONENT_CATALOG = Object.freeze([
  // Metrics & insights
  { type: "metric_cards", label: "Metric Cards", category: "metrics", permission: null },
  { type: "kpi_cards", label: "KPI Cards", category: "metrics", permission: null },
  { type: "insight_cards", label: "Insight Cards", category: "metrics", permission: null },
  { type: "ai_recommendation_cards", label: "AI Recommendation Cards", category: "metrics", permission: null },
  { type: "charts", label: "Charts", category: "metrics", permission: null },
  { type: "reports", label: "Reports", category: "metrics", permission: "performance.view" },

  // Activity & time
  { type: "activity_feed", label: "Activity Feed", category: "timeline", permission: null },
  { type: "timeline", label: "Timeline", category: "timeline", permission: null },
  { type: "calendar", label: "Calendar", category: "timeline", permission: null },
  { type: "scheduling_board", label: "Scheduling Board", category: "timeline", permission: "work.view" },

  // Work & approvals
  { type: "work_queue", label: "Work Queue", category: "work", permission: "work.view" },
  { type: "approval_queue", label: "Approval Queue", category: "work", permission: "work.view" },
  { type: "kanban_board", label: "Kanban Board", category: "work", permission: "work.view" },
  { type: "task_list", label: "Task List", category: "work", permission: "work.view" },

  // Communications
  { type: "communication_center", label: "Communication Center", category: "communications", permission: "inbox.view" },
  { type: "inbox", label: "Inbox", category: "communications", permission: "inbox.view" },
  { type: "notifications", label: "Notifications", category: "communications", permission: null },
  { type: "alerts", label: "Alerts", category: "communications", permission: null },

  // Knowledge
  { type: "knowledge_browser", label: "Knowledge Browser", category: "knowledge", permission: null },
  { type: "document_viewer", label: "Document Viewer", category: "knowledge", permission: null },
  { type: "attachments", label: "Attachments", category: "knowledge", permission: null },

  // Data
  { type: "tables", label: "Tables", category: "data", permission: null },
  { type: "data_grid", label: "Data Grid", category: "data", permission: null },
  { type: "search_results", label: "Search Results", category: "data", permission: null },
  { type: "filters", label: "Filters", category: "data", permission: null },

  // People & org
  { type: "employee_cards", label: "Employee Cards", category: "people", permission: "team.manage" },
  { type: "team_directory", label: "Team Directory", category: "people", permission: "team.manage" },
  { type: "organization_chart", label: "Organization Chart", category: "people", permission: "team.manage" },
  { type: "customer_list", label: "Customer List", category: "people", permission: "people.view" },

  // Subjects / assets (terminology makes these patients/players/properties)
  { type: "asset_list", label: "Asset List", category: "subjects", permission: "people.view" },
  { type: "subject_browser", label: "Subject Browser", category: "subjects", permission: "people.view" },
  { type: "property_browser", label: "Property Browser", category: "subjects", permission: "people.view" },
  { type: "patient_browser", label: "Patient Browser", category: "subjects", permission: "people.view" },
  { type: "player_browser", label: "Player Browser", category: "subjects", permission: "people.view" },

  // Collaboration
  { type: "notes", label: "Notes", category: "collaboration", permission: null },
  { type: "comments", label: "Comments", category: "collaboration", permission: null },
  { type: "audit_history", label: "Audit History", category: "collaboration", permission: null },

  // Actions & chrome
  { type: "quick_actions", label: "Quick Actions", category: "actions", permission: null },
  { type: "dashboard_sections", label: "Dashboard Sections", category: "layout", permission: null },
  { type: "empty_states", label: "Empty States", category: "layout", permission: null },
  { type: "setup_wizards", label: "Setup Wizards", category: "layout", permission: "settings.manage" },
  { type: "status_badges", label: "Status Badges", category: "chrome", permission: null },
  { type: "tags", label: "Tags", category: "chrome", permission: null },
]);

export const UNIVERSAL_COMPONENT_TYPES = Object.freeze(
  UNIVERSAL_COMPONENT_CATALOG.map((entry) => entry.type),
);

/** Types with a static React implementation in components/universal (must stay in sync). */
export const IMPLEMENTED_UNIVERSAL_COMPONENT_TYPES = UNIVERSAL_COMPONENT_TYPES;

export const UNIVERSAL_COMPONENT_SUPPORTS = Object.freeze([
  "role_permissions",
  "terminology_overrides",
  "dark_mode",
  "responsive_layouts",
  "loading_states",
  "empty_states",
  "error_states",
  "accessibility",
  "theme_tokens",
]);

export function getUniversalComponentMeta(type) {
  return UNIVERSAL_COMPONENT_CATALOG.find((entry) => entry.type === String(type)) ?? null;
}

export function isRegisteredUniversalComponent(type) {
  return UNIVERSAL_COMPONENT_TYPES.includes(String(type));
}

export function listUniversalComponentsByCategory(category) {
  return UNIVERSAL_COMPONENT_CATALOG.filter((entry) => entry.category === String(category));
}

export function canRenderUniversalComponent(type, permissions = []) {
  const meta = getUniversalComponentMeta(type);
  if (!meta) return false;
  if (!meta.permission) return true;
  const set = permissions instanceof Set ? permissions : new Set(permissions ?? []);
  return set.has(meta.permission);
}

export function applyUniversalTerminology(label, terminology = null, key = null) {
  if (!terminology) return label;
  const pages = terminology.pages ?? terminology.presentation?.pages ?? {};
  const entities = terminology.entityLabels ?? terminology.presentation?.entityLabels ?? {};
  if (key && entities[key]) return String(entities[key]);
  if (label && pages[label]) return String(pages[label]);
  if (label && entities[label]) return String(entities[label]);
  return label;
}
