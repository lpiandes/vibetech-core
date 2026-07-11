import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Reusable workflow archetypes — Architect specializes these; never invent one-off workflows.
 */
function stage(stageId, label, extras = {}) {
  return {
    stageId,
    label,
    assignment: extras.assignment ?? "manager",
    approvalRequired: Boolean(extras.approvalRequired),
    actions: extras.actions ?? ["create_work"],
    slaHours: extras.slaHours ?? null,
    parallel: Boolean(extras.parallel),
    next: extras.next ?? null,
    conditions: extras.conditions ?? [],
  };
}

export const WORKFLOW_ARCHETYPES = deepFreeze({
  intake_to_work: {
    archetypeId: "intake_to_work",
    label: "Intake → Work",
    category: "operations",
    defaultTrigger: "object_created",
    stages: [
      stage("intake", "Intake", { assignment: "coordinator", actions: ["create_work", "send_notification"] }),
      stage("qualify", "Qualify", { assignment: "manager", actions: ["update_object", "assign_work"] }),
      stage("complete", "Complete", { assignment: "manager", actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 24, action: "escalate", to: "manager" }],
    approvals: [],
  },
  approval_gated: {
    archetypeId: "approval_gated",
    label: "Approval-gated action",
    category: "governance",
    defaultTrigger: "manual_start",
    stages: [
      stage("draft", "Draft", { assignment: "employee", actions: ["create_work"] }),
      stage("approve", "Approve", {
        assignment: "owner",
        approvalRequired: true,
        actions: ["create_approval", "request_review"],
      }),
      stage("execute", "Execute", { assignment: "ai_employee", actions: ["run_ai_employee", "queue_communication"] }),
      stage("complete", "Complete", { assignment: "manager", actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 48, action: "escalate", to: "owner" }],
    approvals: ["owner"],
  },
  follow_up_loop: {
    archetypeId: "follow_up_loop",
    label: "Follow-up loop",
    category: "relationship",
    defaultTrigger: "time_elapsed",
    stages: [
      stage("detect", "Detect due", { assignment: "ai_employee", actions: ["create_work"] }),
      stage("draft", "Draft outreach", { assignment: "ai_employee", actions: ["run_ai_employee", "queue_communication"] }),
      stage("review", "Human review", { assignment: "manager", approvalRequired: true, actions: ["create_approval"] }),
      stage("send", "Send", { assignment: "coordinator", actions: ["queue_communication"] }),
      stage("complete", "Complete", { actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 72, action: "escalate", to: "manager" }],
    approvals: ["manager"],
    features: ["loops", "timers"],
  },
  work_completion: {
    archetypeId: "work_completion",
    label: "Work completion cascade",
    category: "operations",
    defaultTrigger: "work_completed",
    stages: [
      stage("verify", "Verify", { assignment: "manager", actions: ["request_review"] }),
      stage("notify", "Notify", { assignment: "coordinator", actions: ["send_notification", "queue_communication"] }),
      stage("close", "Close", { actions: ["update_object", "close_workflow"] }),
    ],
    escalations: [],
    approvals: [],
  },
  sla_escalation: {
    archetypeId: "sla_escalation",
    label: "SLA escalation",
    category: "operations",
    defaultTrigger: "time_elapsed",
    stages: [
      stage("monitor", "Monitor SLA", { assignment: "ai_employee", actions: ["create_work"], slaHours: 4 }),
      stage("warn", "Warn assignee", { assignment: "coordinator", actions: ["send_notification"] }),
      stage("escalate", "Escalate", { assignment: "manager", actions: ["escalate", "assign_work"] }),
      stage("resolve", "Resolve", { assignment: "manager", actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 4, action: "escalate", to: "manager" }, { afterHours: 24, action: "escalate", to: "owner" }],
    approvals: [],
    features: ["timers", "sla_tracking", "escalations"],
  },
  communication_intake: {
    archetypeId: "communication_intake",
    label: "Communication intake",
    category: "comms",
    defaultTrigger: "communication_received",
    stages: [
      stage("triage", "Triage", { assignment: "ai_employee", actions: ["run_ai_employee", "create_work"] }),
      stage("route", "Route", { assignment: "coordinator", actions: ["assign_work"] }),
      stage("respond", "Respond", { assignment: "employee", actions: ["queue_communication"] }),
      stage("complete", "Complete", { actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 8, action: "escalate", to: "manager" }],
    approvals: [],
  },
  scheduled_report: {
    archetypeId: "scheduled_report",
    label: "Scheduled report",
    category: "analytics",
    defaultTrigger: "recurring_schedule",
    stages: [
      stage("collect", "Collect", { assignment: "ai_employee", actions: ["run_ai_employee"] }),
      stage("generate", "Generate", { assignment: "ai_employee", actions: ["generate_report"] }),
      stage("deliver", "Deliver", { assignment: "coordinator", actions: ["send_notification"] }),
      stage("complete", "Complete", { actions: ["close_workflow"] }),
    ],
    escalations: [],
    approvals: [],
  },
  integration_sync: {
    archetypeId: "integration_sync",
    label: "Integration sync",
    category: "integration",
    defaultTrigger: "integration_event",
    stages: [
      stage("receive", "Receive event", { actions: ["create_record"] }),
      stage("map", "Map fields", { assignment: "ai_employee", actions: ["update_object"] }),
      stage("act", "Act", { assignment: "coordinator", actions: ["create_work", "call_integration"] }),
      stage("complete", "Complete", { actions: ["close_workflow"] }),
    ],
    escalations: [{ afterHours: 12, action: "escalate", to: "manager" }],
    approvals: [],
  },
});

/**
 * Industry templates pick reusable workflow archetypes — not vertical engines.
 */
export const WORKFLOW_TEMPLATES = deepFreeze({
  property_management: {
    workflows: [
      { archetypeId: "intake_to_work", workflowId: "prospect_intake", label: "Prospect intake", trigger: "object_created", objectHint: "prospect" },
      { archetypeId: "follow_up_loop", workflowId: "resident_follow_up", label: "Resident follow-up", trigger: "time_elapsed" },
      { archetypeId: "work_completion", workflowId: "maintenance_complete", label: "Maintenance completion", trigger: "work_completed" },
      { archetypeId: "sla_escalation", workflowId: "maintenance_sla", label: "Maintenance SLA", trigger: "time_elapsed" },
      { archetypeId: "approval_gated", workflowId: "campaign_send", label: "Campaign approval", trigger: "manual_start" },
      { archetypeId: "communication_intake", workflowId: "inbox_triage", label: "Inbox triage", trigger: "communication_received" },
    ],
  },
  dental: {
    workflows: [
      { archetypeId: "intake_to_work", workflowId: "patient_intake", label: "Patient intake", trigger: "object_created", objectHint: "patient" },
      { archetypeId: "follow_up_loop", workflowId: "recall_follow_up", label: "Recall follow-up", trigger: "date_reached" },
      { archetypeId: "work_completion", workflowId: "appointment_complete", label: "Appointment completion", trigger: "work_completed" },
      { archetypeId: "approval_gated", workflowId: "treatment_plan_approval", label: "Treatment plan approval", trigger: "manual_start" },
      { archetypeId: "scheduled_report", workflowId: "daily_ops_report", label: "Daily ops report", trigger: "recurring_schedule" },
      { archetypeId: "communication_intake", workflowId: "patient_message_triage", label: "Patient message triage", trigger: "communication_received" },
    ],
  },
  sports: {
    workflows: [
      { archetypeId: "intake_to_work", workflowId: "player_registration", label: "Player registration", trigger: "object_created", objectHint: "player" },
      { archetypeId: "follow_up_loop", workflowId: "parent_follow_up", label: "Parent follow-up", trigger: "time_elapsed" },
      { archetypeId: "approval_gated", workflowId: "travel_approval", label: "Travel approval", trigger: "manual_start" },
      { archetypeId: "scheduled_report", workflowId: "practice_plan_report", label: "Practice plan report", trigger: "recurring_schedule" },
      { archetypeId: "sla_escalation", workflowId: "travel_sla", label: "Travel SLA", trigger: "time_elapsed" },
      { archetypeId: "communication_intake", workflowId: "parent_inbox", label: "Parent inbox triage", trigger: "communication_received" },
    ],
  },
  default: {
    workflows: [
      { archetypeId: "intake_to_work", workflowId: "lead_intake", label: "Lead intake", trigger: "object_created", objectHint: "lead" },
      { archetypeId: "follow_up_loop", workflowId: "customer_follow_up", label: "Customer follow-up", trigger: "time_elapsed" },
      { archetypeId: "approval_gated", workflowId: "owner_approval", label: "Owner approval", trigger: "manual_start" },
      { archetypeId: "work_completion", workflowId: "case_complete", label: "Case completion", trigger: "work_completed" },
      { archetypeId: "sla_escalation", workflowId: "case_sla", label: "Case SLA", trigger: "time_elapsed" },
      { archetypeId: "scheduled_report", workflowId: "weekly_kpi", label: "Weekly KPI report", trigger: "recurring_schedule" },
    ],
  },
});

export function getWorkflowArchetype(archetypeId) {
  return WORKFLOW_ARCHETYPES[String(archetypeId)] ?? null;
}

export function listWorkflowArchetypeIds() {
  return Object.keys(WORKFLOW_ARCHETYPES);
}

export function resolveWorkflowTemplate(industry) {
  const key = String(industry ?? "default");
  return WORKFLOW_TEMPLATES[key] ?? WORKFLOW_TEMPLATES.default;
}
