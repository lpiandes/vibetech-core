export const ANALYTICS_INTELLIGENCE_KPI_DEFINITIONS = [
  {
    kpiId: "request_volume",
    name: "Request Volume",
    metricId: "request_received_count",
    category: "requests",
    description: "How many incoming requests were recorded.",
    unit: "count",
  },
  {
    kpiId: "request_conversion_count",
    name: "Conversion Count",
    metricId: "request_converted_count",
    category: "requests",
    description: "How many requests were converted to work.",
    unit: "count",
  },
  {
    kpiId: "work_created_count",
    name: "Work Created",
    metricId: "work_created_count",
    category: "work",
    description: "How many work items were created.",
    unit: "count",
  },
  {
    kpiId: "work_completed_count",
    name: "Work Completed",
    metricId: "work_completed_count",
    category: "work",
    description: "How many work items were completed.",
    unit: "count",
  },
  {
    kpiId: "communication_success_count",
    name: "Communication Success",
    metricId: "communication_sent_count",
    category: "communications",
    description: "How many communications were recorded as sent.",
    unit: "count",
  },
  {
    kpiId: "communication_failure_count",
    name: "Communication Failure",
    metricId: "communication_failed_count",
    category: "communications",
    description: "How many communications were recorded as failed.",
    unit: "count",
  },
  {
    kpiId: "team_growth_net",
    name: "Team Growth (Net)",
    metricId: "team_member_created_count",
    category: "team",
    description: "Net team growth derived from created vs archived datapoints.",
    unit: "count",
    uses: { createdMetricId: "team_member_created_count", archivedMetricId: "team_member_archived_count" },
  },
  {
    kpiId: "capability_growth_net",
    name: "Capability Growth (Net)",
    metricId: "capability_registered_count",
    category: "capabilities",
    description: "Net capability growth derived from registered vs archived datapoints.",
    unit: "count",
    uses: { createdMetricId: "capability_registered_count", archivedMetricId: "capability_archived_count" },
  },
];

export const TREND_DIRECTIONS = ["improving", "stable", "declining", "unknown"];

export const OVERALL_PERFORMANCE_COMPONENT_WEIGHTS = [
  { key: "conversionRate", weight: 0.25 },
  { key: "completionRate", weight: 0.25 },
  { key: "communicationSuccessRate", weight: 0.25 },
  { key: "growthNet", weight: 0.25 },
];

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

