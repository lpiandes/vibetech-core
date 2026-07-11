export const DASHBOARD_CARD_TYPES = Object.freeze([
  "metric_cards",
  "attention_queue",
  "work_queue",
  "digital_workforce",
  "pipeline",
  "subject_summaries",
  "communication_summary",
  "calendar_deadlines",
  "readiness",
  "charts",
]);

export function isRegisteredDashboardCard(type) {
  return DASHBOARD_CARD_TYPES.includes(String(type));
}
