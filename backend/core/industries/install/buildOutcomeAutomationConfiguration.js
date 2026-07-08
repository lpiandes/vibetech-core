/**
 * Shared helper for industry automation pack configurations.
 * Uses universal tpl_outcome_creates_work template — no industry logic in Core.
 */
export function buildOutcomeAutomationConfiguration({
  outcomeValue,
  workType,
  title,
  description,
  workItemIdPrefix,
  requiresApproval = false,
  actionId,
  priority = "medium",
  stageId = "stage_intake",
  queueId = "queue_needs_review",
  assignedTo = "unassigned",
  source = "automation:industry_package",
} = {}) {
  return {
    triggerEventType: "INTERACTION_OUTCOME_RECORDED",
    outcomeFieldPath: "payload.outcome",
    outcomeValue: String(outcomeValue ?? ""),
    actionId: String(actionId ?? `act_${String(outcomeValue)}`),
    requiresApproval: Boolean(requiresApproval),
    workItemIdPrefix: String(workItemIdPrefix ?? "work_auto_pkg_"),
    workType: String(workType ?? "operational_action"),
    title: String(title ?? "Configured work"),
    description: String(description ?? "Work created from installed industry automation configuration."),
    priority: String(priority),
    stageId: String(stageId),
    queueId: String(queueId),
    assignedTo: String(assignedTo),
    requestedBy: "tm_system",
    source: String(source),
    workStatus: "new",
  };
}
