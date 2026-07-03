import { SUPPORTED_METRIC_CATEGORIES } from "../AnalyticsMetric.js";

export const ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT = {
  REQUEST_RECEIVED: { metricId: "request_received_count", name: "Request received count", category: "requests" },
  REQUEST_QUALIFIED: { metricId: "request_qualified_count", name: "Request qualified count", category: "requests" },
  REQUEST_CONVERTED: { metricId: "request_converted_count", name: "Request converted count", category: "requests" },
  REQUEST_REJECTED: { metricId: "request_rejected_count", name: "Request rejected count", category: "requests" },

  WORK_CREATED: { metricId: "work_created_count", name: "Work created count", category: "work" },
  WORK_ASSIGNED: { metricId: "work_assigned_count", name: "Work assigned count", category: "work" },
  WORK_COMPLETED: { metricId: "work_completed_count", name: "Work completed count", category: "work" },

  COMMUNICATION_SENT: { metricId: "communication_sent_count", name: "Communication sent count", category: "communications" },
  COMMUNICATION_FAILED: { metricId: "communication_failed_count", name: "Communication failed count", category: "communications" },
  COMMUNICATION_RECEIVED: { metricId: "communication_received_count", name: "Communication received count", category: "communications" },

  TEAM_MEMBER_CREATED: { metricId: "team_member_created_count", name: "Team member created count", category: "team" },
  TEAM_MEMBER_ADDED: { metricId: "team_member_created_count", name: "Team member created count", category: "team" },
  TEAM_MEMBER_ARCHIVED: { metricId: "team_member_archived_count", name: "Team member archived count", category: "team" },

  CAPABILITY_REGISTERED: { metricId: "capability_registered_count", name: "Capability registered count", category: "capabilities" },
  CAPABILITY_ARCHIVED: { metricId: "capability_archived_count", name: "Capability archived count", category: "capabilities" },
};

export const DEFAULT_METRIC_DEFINITION = {
  unit: "count",
  aggregationType: "count",
  dimensions: [],
  metadata: {},
};

export function validateMetricCategory(category) {
  if (!SUPPORTED_METRIC_CATEGORIES.includes(String(category))) {
    throw new Error(`AnalyticsEventDefaults: unsupported metric category: ${String(category)}`);
  }
  return { ok: true };
}

