import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Universal workflow triggers — one registry for every business.
 */
export const WORKFLOW_TRIGGERS = deepFreeze({
  object_created: { triggerId: "object_created", label: "Object created", category: "object" },
  object_updated: { triggerId: "object_updated", label: "Object updated", category: "object" },
  object_deleted: { triggerId: "object_deleted", label: "Object deleted", category: "object" },
  field_changed: { triggerId: "field_changed", label: "Field changed", category: "object" },
  date_reached: { triggerId: "date_reached", label: "Date reached", category: "time" },
  time_elapsed: { triggerId: "time_elapsed", label: "Time elapsed", category: "time" },
  approval_completed: { triggerId: "approval_completed", label: "Approval completed", category: "governance" },
  work_completed: { triggerId: "work_completed", label: "Work completed", category: "work" },
  communication_received: { triggerId: "communication_received", label: "Communication received", category: "comms" },
  manual_start: { triggerId: "manual_start", label: "Manual start", category: "manual" },
  recurring_schedule: { triggerId: "recurring_schedule", label: "Recurring schedule", category: "time" },
  ai_recommendation_accepted: { triggerId: "ai_recommendation_accepted", label: "AI recommendation accepted", category: "ai" },
  integration_event: { triggerId: "integration_event", label: "Integration event", category: "integration" },
});

export const WORKFLOW_ACTIONS = deepFreeze({
  create_work: { actionId: "create_work", label: "Create Work", mapsToAutomation: "CREATE_WORK" },
  assign_work: { actionId: "assign_work", label: "Assign Work", mapsToAutomation: null },
  create_approval: { actionId: "create_approval", label: "Create Approval", mapsToAutomation: null },
  send_notification: { actionId: "send_notification", label: "Send Notification", mapsToAutomation: null },
  queue_communication: { actionId: "queue_communication", label: "Queue Communication", mapsToAutomation: null },
  update_object: { actionId: "update_object", label: "Update Object", mapsToAutomation: null },
  create_record: { actionId: "create_record", label: "Create Record", mapsToAutomation: null },
  schedule_task: { actionId: "schedule_task", label: "Schedule Task", mapsToAutomation: null },
  generate_report: { actionId: "generate_report", label: "Generate Report", mapsToAutomation: null },
  request_review: { actionId: "request_review", label: "Request Review", mapsToAutomation: null },
  escalate: { actionId: "escalate", label: "Escalate", mapsToAutomation: null },
  close_workflow: { actionId: "close_workflow", label: "Close Workflow", mapsToAutomation: null },
  call_integration: { actionId: "call_integration", label: "Call Integration", mapsToAutomation: "EXECUTE_EXTERNAL_ACTION" },
  run_ai_employee: { actionId: "run_ai_employee", label: "Run AI Employee", mapsToAutomation: null },
});

export const WORKFLOW_CONTROL_OPS = deepFreeze([
  "pause",
  "resume",
  "cancel",
  "restart",
  "manual_override",
]);

export const WORKFLOW_FEATURES = deepFreeze([
  "stages",
  "parallel_paths",
  "conditional_branches",
  "loops",
  "timers",
  "sla_tracking",
  "escalations",
  "manual_overrides",
  "versioning",
  "simulation",
]);

export function listTriggerIds() {
  return Object.keys(WORKFLOW_TRIGGERS);
}

export function listActionIds() {
  return Object.keys(WORKFLOW_ACTIONS);
}

export function isKnownTrigger(triggerId) {
  return Boolean(WORKFLOW_TRIGGERS[String(triggerId)]);
}

export function isKnownAction(actionId) {
  return Boolean(WORKFLOW_ACTIONS[String(actionId)]);
}
