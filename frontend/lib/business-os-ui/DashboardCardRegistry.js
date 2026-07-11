export const DASHBOARD_CARD_TYPES = Object.freeze([
  "metric_cards",
  "kpi_cards",
  "attention_queue",
  "recent_activity",
  "work_queue",
  "digital_workforce",
  "pipeline",
  "subject_summaries",
  "communication_summary",
  "calendar_deadlines",
  "readiness",
  "charts",
  "reports",
  "operational_alerts",
]);

export function isRegisteredDashboardCard(type) {
  return DASHBOARD_CARD_TYPES.includes(String(type));
}
