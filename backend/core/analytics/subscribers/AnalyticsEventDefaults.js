import { SUPPORTED_METRIC_CATEGORIES } from "../AnalyticsMetric.js";

export const ANALYTICS_DATA_POINT_METRIC_BY_PLATFORM_EVENT = {
  REQUEST_RECEIVED: { metricId: "request_received_count", name: "Request received count", category: "requests" },
  REQUEST_QUALIFIED: { metricId: "request_qualified_count", name: "Request qualified count", category: "requests" },
  REQUEST_CONVERTED: { metricId: "request_converted_count", name: "Request converted count", category: "requests" },
  REQUEST_REJECTED: { metricId: "request_rejected_count", name: "Request rejected count", category: "requests" },

  WORK_CREATED: { metricId: "work_created_count", name: "Work created count", category: "work" },
  WORK_ASSIGNED: { metricId: "work_assigned_count", name: "Work assigned count", category: "work" },
  WORK_COMPLETED: { metricId: "work_completed_count", name: "Work completed count", category: "work" },

  INTERACTION_RECORDED: { metricId: "interaction_recorded_count", name: "Interaction recorded count", category: "operations" },
  INTERACTION_OUTCOME_RECORDED: { metricId: "interaction_outcome_recorded_count", name: "Interaction outcome recorded count", category: "operations" },
  FOLLOW_UP_SCHEDULED: { metricId: "follow_up_scheduled_count", name: "Follow up scheduled count", category: "operations" },

  AUTOMATION_RUN_STARTED: { metricId: "automation_run_started_count", name: "Automation run started count", category: "operations" },
  AUTOMATION_RUN_COMPLETED: { metricId: "automation_run_completed_count", name: "Automation run completed count", category: "operations" },
  AUTOMATION_RUN_FAILED: { metricId: "automation_run_failed_count", name: "Automation run failed count", category: "operations" },

  APPROVAL_REQUESTED: { metricId: "approval_requested_count", name: "Approval requested count", category: "operations" },
  APPROVAL_GRANTED: { metricId: "approval_granted_count", name: "Approval granted count", category: "operations" },
  APPROVAL_REJECTED: { metricId: "approval_rejected_count", name: "Approval rejected count", category: "operations" },

  COMMUNICATION_SENT: { metricId: "communication_sent_count", name: "Communication sent count", category: "communications" },
  COMMUNICATION_FAILED: { metricId: "communication_failed_count", name: "Communication failed count", category: "communications" },
  COMMUNICATION_RECEIVED: { metricId: "communication_received_count", name: "Communication received count", category: "communications" },

  CONNECTION_CONNECTED: { metricId: "connection_connected_count", name: "Connection connected count", category: "operations" },
  CONNECTION_VERIFIED: { metricId: "connection_verified_count", name: "Connection verified count", category: "operations" },
  CONNECTION_FAILED: { metricId: "connection_failed_count", name: "Connection failed count", category: "operations" },
  EXTERNAL_ACTION_REQUESTED: { metricId: "external_action_requested_count", name: "External action requested count", category: "operations" },
  EXTERNAL_ACTION_COMPLETED: { metricId: "external_action_completed_count", name: "External action completed count", category: "operations" },
  EXTERNAL_ACTION_FAILED: { metricId: "external_action_failed_count", name: "External action failed count", category: "operations" },
  INBOUND_EVENT_RECEIVED: { metricId: "inbound_event_received_count", name: "Inbound event received count", category: "operations" },
  INBOUND_EVENT_REJECTED: { metricId: "inbound_event_rejected_count", name: "Inbound event rejected count", category: "operations" },

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

