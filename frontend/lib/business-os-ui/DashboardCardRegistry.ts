export const DASHBOARD_CARD_TYPES = [
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
] as const;

export type DashboardCardType = (typeof DASHBOARD_CARD_TYPES)[number];

export function isRegisteredDashboardCard(type: string): type is DashboardCardType {
  return (DASHBOARD_CARD_TYPES as readonly string[]).includes(type);
}
