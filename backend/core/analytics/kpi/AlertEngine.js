import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { METRIC_AVAILABILITY } from "./MetricDefinition.js";

/**
 * Deterministic alerts from calculated metric results + evidence.
 * Recommends action — does not silently create Work.
 */
export function evaluateAlerts({ metricResults = [], evidence = {} } = {}) {
  const alerts = [];

  for (const result of metricResults) {
    if (result.availability !== METRIC_AVAILABILITY.available && result.availability !== METRIC_AVAILABILITY.stale) {
      continue;
    }
    if (result.alert) {
      alerts.push(createAlert({
        alertId: `alert_${result.metricId}_${result.alert.level}`,
        kind: mapMetricToAlertKind(result.metricId),
        level: result.alert.level,
        label: result.alert.message,
        metricId: result.metricId,
        recommendedAction: actionFor(result.metricId),
        createsWork: false,
        evidence: result.drillDownEvidence?.slice(0, 5) ?? [],
      }));
    }
  }

  const workItems = Array.isArray(evidence.workItems) ? evidence.workItems : [];
  const overdue = workItems.filter((item) => {
    const status = String(item.status ?? "").toUpperCase();
    if (status === "COMPLETED" || status === "CANCELLED") return false;
    return item.dueAt && Date.parse(item.dueAt) < Date.now();
  });
  if (overdue.length && !alerts.some((entry) => entry.kind === "overdue_work")) {
    alerts.push(createAlert({
      alertId: "alert_overdue_work",
      kind: "overdue_work",
      level: overdue.length > 10 ? "critical" : "warning",
      label: `${overdue.length} overdue Work item(s)`,
      recommendedAction: "Review overdue Work and reassign or complete.",
      createsWork: false,
      evidence: overdue.slice(0, 5).map((item) => ({ id: item.id, label: item.title ?? item.id })),
    }));
  }

  return deepFreeze(alerts);
}

function createAlert({
  alertId,
  kind,
  level = "warning",
  label,
  metricId = null,
  recommendedAction = "",
  createsWork = false,
  evidence = [],
}) {
  return deepFreeze({
    alertId: String(alertId),
    kind: String(kind),
    level: String(level),
    label: String(label),
    metricId,
    recommendedAction: String(recommendedAction),
    createsWork: Boolean(createsWork),
    evidence: deepFreeze(evidence),
  });
}

function mapMetricToAlertKind(metricId) {
  switch (String(metricId)) {
    case "overdue_work_count": return "overdue_work";
    case "open_work_count": return "rising_backlog";
    case "unassigned_work_count": return "unassigned_work";
    case "sla_compliance_rate": return "sla_breach_risk";
    case "failed_integrations_count": return "failed_integrations";
    case "knowledge_document_count": return "missing_knowledge";
    case "pending_approvals_count": return "unresolved_approvals";
    case "team_capacity_utilization": return "approaching_capacity";
    case "avg_response_hours": return "repeated_no_response";
    default: return "threshold";
  }
}

function actionFor(metricId) {
  switch (String(metricId)) {
    case "overdue_work_count": return "Triage overdue Work in the Work queue.";
    case "unassigned_work_count": return "Assign owners to unassigned Work.";
    case "pending_approvals_count": return "Clear pending approvals.";
    case "failed_integrations_count": return "Open Integrations and reconnect failed providers.";
    case "team_capacity_utilization": return "Rebalance workload or pause intake.";
    default: return "Review the metric drill-down evidence.";
  }
}
