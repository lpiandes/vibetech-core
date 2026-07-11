import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export const METRIC_VALUE_TYPES = deepFreeze([
  "count",
  "total",
  "average",
  "percentage",
  "duration",
  "conversion_rate",
  "backlog",
  "aging",
  "sla_compliance",
  "completion_rate",
  "response_time",
  "workload",
  "capacity",
  "quality",
  "revenue",
  "cost",
]);

export const METRIC_AGGREGATIONS = deepFreeze([
  "count",
  "sum",
  "average",
  "min",
  "max",
  "ratio",
  "latest",
]);

export const METRIC_AVAILABILITY = deepFreeze({
  available: "available",
  insufficient_data: "insufficient_data",
  stale: "stale",
  unavailable: "unavailable",
  needs_setup: "needs_setup",
  unsupported: "unsupported",
});

export const METRIC_CATEGORIES = deepFreeze([
  "executive",
  "operational",
  "team",
  "workflow",
  "customer",
  "integration",
  "readiness",
  "quality",
  "financial",
]);

/**
 * Universal MetricDefinition contract — restart-safe, evidence-bound.
 */
export function createMetricDefinition({
  metricId,
  label,
  description = "",
  category = "operational",
  valueType = "count",
  aggregation = "count",
  sourceRuntime = "work",
  sourceFields = [],
  filters = {},
  dimensions = [],
  timeWindow = "7d",
  comparisonWindow = "previous_7d",
  target = null,
  thresholds = {},
  permissions = ["OWNER", "MANAGER"],
  drillDownRoute = null,
  evidenceContract = {},
  emptyState = "No data yet for this metric.",
  requiresFinancialEvidence = false,
  fabricatedForbidden = true,
} = {}) {
  if (!metricId) throw new Error("MetricDefinition: metricId required.");
  if (!label) throw new Error("MetricDefinition: label required.");
  if (!METRIC_CATEGORIES.includes(String(category))) {
    throw new Error(`MetricDefinition: unsupported category ${category}`);
  }
  if (!METRIC_VALUE_TYPES.includes(String(valueType))) {
    throw new Error(`MetricDefinition: unsupported valueType ${valueType}`);
  }
  if (!METRIC_AGGREGATIONS.includes(String(aggregation))) {
    throw new Error(`MetricDefinition: unsupported aggregation ${aggregation}`);
  }

  return deepFreeze({
    metricId: String(metricId),
    label: String(label),
    description: String(description),
    category: String(category),
    valueType: String(valueType),
    aggregation: String(aggregation),
    sourceRuntime: String(sourceRuntime),
    sourceFields: deepFreeze(Array.isArray(sourceFields) ? sourceFields.map(String) : []),
    filters: deepFreeze(filters && typeof filters === "object" ? filters : {}),
    dimensions: deepFreeze(Array.isArray(dimensions) ? dimensions.map(String) : []),
    timeWindow: String(timeWindow),
    comparisonWindow: String(comparisonWindow),
    target: target == null ? null : Number(target),
    thresholds: deepFreeze(thresholds && typeof thresholds === "object" ? thresholds : {}),
    permissions: deepFreeze(Array.isArray(permissions) ? permissions.map(String) : []),
    drillDownRoute: drillDownRoute == null ? null : String(drillDownRoute),
    evidenceContract: deepFreeze(evidenceContract && typeof evidenceContract === "object" ? evidenceContract : {}),
    emptyState: String(emptyState),
    requiresFinancialEvidence: Boolean(requiresFinancialEvidence),
    fabricatedForbidden: fabricatedForbidden !== false,
  });
}
