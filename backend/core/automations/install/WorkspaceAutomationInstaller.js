import { OUTCOME_CREATES_WORK_TEMPLATE } from "../templates/AutomationTemplateRegistry.js";
import { installAutomationTemplate } from "../templates/AutomationTemplateInstaller.js";

/**
 * Demo/workspace configuration — NOT Automation Core behavior.
 * @param {{ automationRuntime: import("../AutomationRuntime.js").AutomationRuntime, template?: object, configuration: object, nowISO?: string }} args
 */
export function installConnectedDemoAutomation({
  automationRuntime,
  template = OUTCOME_CREATES_WORK_TEMPLATE,
  configuration,
  nowISO,
} = {}) {
  return installAutomationTemplate({
    template,
    configuration,
    automationRuntime,
    nowISO,
  });
}

/** Default connected-business demo automation configuration (Scenario 4.0 fixture). */
export function buildConnectedDemoAutomationConfiguration({
  workItemIdPrefix = "work_auto_outcome_",
} = {}) {
  return {
    triggerEventType: "INTERACTION_OUTCOME_RECORDED",
    outcomeFieldPath: "payload.outcome",
    outcomeValue: "follow_up_required",
    actionId: "act_create_outcome_work",
    requiresApproval: false,
    workItemIdPrefix,
    workType: "relationship_follow_up",
    title: "Complete configured outcome follow-up",
    description: "Work created from installed automation template configuration.",
    priority: "medium",
    stageId: "stage_follow_up",
    queueId: "queue_follow_up",
    assignedTo: "tm_ceo",
    requestedBy: "tm_system",
    source: "automation:installed_template",
    workStatus: "new",
  };
}

/** Approval-gated demo configuration for external response workflow proof. */
export function buildExternalResponseAutomationConfiguration({
  workItemIdPrefix = "work_auto_external_",
} = {}) {
  return {
    triggerEventType: "INTERACTION_OUTCOME_RECORDED",
    outcomeFieldPath: "payload.outcome",
    outcomeValue: "external_response_required",
    actionId: "act_create_external_response_work",
    requiresApproval: true,
    workItemIdPrefix,
    workType: "external_response",
    title: "External response work (approval-gated)",
    description: "Requires authorization before external response work is created.",
    priority: "high",
    stageId: "stage_review",
    queueId: "queue_needs_review",
    assignedTo: "tm_ceo",
    requestedBy: "tm_system",
    source: "automation:external_response_gated",
    workStatus: "new",
  };
}

/** Approval-gated demo configuration for deterministic human-in-the-loop proof. */
export function buildApprovalGatedAutomationConfiguration({
  workItemIdPrefix = "work_auto_gated_",
  outcomeValue = "action_required",
} = {}) {
  return {
    triggerEventType: "INTERACTION_OUTCOME_RECORDED",
    outcomeFieldPath: "payload.outcome",
    outcomeValue,
    actionId: "act_create_gated_work",
    requiresApproval: true,
    workItemIdPrefix,
    workType: "operational_action",
    title: "Approval-gated work creation",
    description: "Requires authorization before work is created.",
    priority: "high",
    stageId: "stage_review",
    queueId: "queue_needs_review",
    assignedTo: "tm_owner",
    requestedBy: "tm_system",
    source: "automation:approval_gated",
    workStatus: "new",
  };
}

/** Universality test configurations — generic outcome labels, not industry nouns. */
export const UNIVERSALITY_TEST_CONFIGS = {
  relationshipFollowUp: {
    outcomeValue: "follow_up_required",
    workType: "relationship_follow_up",
    title: "Relationship follow-up work",
    stageId: "stage_follow_up",
    queueId: "queue_follow_up",
    workItemIdPrefix: "work_auto_rel_",
  },
  reviewRequired: {
    outcomeValue: "review_required",
    workType: "review",
    title: "Review work item",
    stageId: "stage_review",
    queueId: "queue_needs_review",
    workItemIdPrefix: "work_auto_rev_",
  },
  actionRequired: {
    outcomeValue: "action_required",
    workType: "operational_action",
    title: "Operational action work",
    stageId: "stage_execution",
    queueId: "queue_in_progress",
    workItemIdPrefix: "work_auto_act_",
  },
};

export function buildUniversalityConfiguration(overrides = {}) {
  const base = {
    triggerEventType: "INTERACTION_OUTCOME_RECORDED",
    outcomeFieldPath: "payload.outcome",
    outcomeValue: "action_required",
    actionId: "act_universal_work",
    requiresApproval: false,
    workItemIdPrefix: "work_auto_universal_",
    workType: "operational_action",
    title: "Universal configured work",
    description: "Installed from universal template configuration.",
    priority: "medium",
    stageId: "stage_intake",
    queueId: "queue_needs_review",
    assignedTo: "tm_owner",
    requestedBy: "tm_system",
    source: "automation:universality_test",
    workStatus: "new",
  };
  return { ...base, ...overrides };
}
