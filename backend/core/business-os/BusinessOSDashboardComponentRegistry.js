import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Safe dashboard widget registry.
 * Specs may only reference these component types — no arbitrary React generation.
 */
export const BUSINESS_OS_DASHBOARD_COMPONENTS = deepFreeze([
  { type: "metric_cards", label: "Metric cards", projectionKinds: ["metrics", "summary"] },
  { type: "kpi_cards", label: "KPI cards", projectionKinds: ["metrics", "analytics"] },
  { type: "attention_queue", label: "Attention queue", projectionKinds: ["attention", "work"] },
  { type: "recent_activity", label: "Recent activity", projectionKinds: ["activity", "timeline"] },
  { type: "work_queue", label: "Work queue", projectionKinds: ["work"] },
  { type: "digital_workforce", label: "Digital workforce", projectionKinds: ["workforce", "team"] },
  { type: "subject_summaries", label: "Subject summaries", projectionKinds: ["subjects", "portfolio"] },
  { type: "pipeline", label: "Pipeline", projectionKinds: ["pipeline", "relationships"] },
  { type: "calendar_deadlines", label: "Calendar and deadlines", projectionKinds: ["calendar", "deadlines"] },
  { type: "communication_summary", label: "Communication summary", projectionKinds: ["communications"] },
  { type: "charts", label: "Charts", projectionKinds: ["metrics", "analytics"] },
  { type: "reports", label: "Reports", projectionKinds: ["analytics", "reports"] },
  { type: "readiness", label: "Readiness", projectionKinds: ["readiness"] },
  { type: "operational_alerts", label: "Operational alerts", projectionKinds: ["alerts", "attention"] },
]);

export function listDashboardComponentTypes() {
  return BUSINESS_OS_DASHBOARD_COMPONENTS.map((entry) => entry.type);
}

export function getDashboardComponent(type) {
  return BUSINESS_OS_DASHBOARD_COMPONENTS.find((entry) => entry.type === String(type ?? "")) ?? null;
}

export function isRegisteredDashboardComponent(type) {
  return Boolean(getDashboardComponent(type));
}
