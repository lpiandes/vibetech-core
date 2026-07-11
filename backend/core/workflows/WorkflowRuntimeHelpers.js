import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { isKnownTrigger, WORKFLOW_TRIGGERS } from "./WorkflowRegistries.js";

/**
 * Evaluate whether an event matches a workflow trigger definition.
 */
export function evaluateTrigger(trigger, event = {}) {
  if (!trigger?.triggerId) {
    return deepFreeze({ matched: false, reason: "trigger_missing" });
  }
  if (!isKnownTrigger(trigger.triggerId)) {
    return deepFreeze({ matched: false, reason: "unknown_trigger" });
  }

  const eventType = String(event.type ?? event.triggerId ?? "");
  if (eventType && eventType !== trigger.triggerId) {
    return deepFreeze({ matched: false, reason: "type_mismatch", expected: trigger.triggerId, actual: eventType });
  }

  if (trigger.objectType && event.objectType && String(trigger.objectType) !== String(event.objectType)) {
    return deepFreeze({ matched: false, reason: "object_type_mismatch" });
  }

  if (trigger.fieldKey && event.fieldKey && String(trigger.fieldKey) !== String(event.fieldKey)) {
    return deepFreeze({ matched: false, reason: "field_mismatch" });
  }

  for (const condition of trigger.conditions ?? []) {
    const actual = event.payload?.[condition.field] ?? event[condition.field];
    if (condition.equals !== undefined && actual !== condition.equals) {
      return deepFreeze({ matched: false, reason: "condition_failed", field: condition.field });
    }
    if (Array.isArray(condition.in) && !condition.in.includes(actual)) {
      return deepFreeze({ matched: false, reason: "condition_failed", field: condition.field });
    }
  }

  return deepFreeze({
    matched: true,
    reason: "matched",
    triggerId: trigger.triggerId,
    label: WORKFLOW_TRIGGERS[trigger.triggerId]?.label ?? trigger.triggerId,
  });
}

/**
 * Simulate a workflow run without mutating tenant state.
 */
export function simulateWorkflow(workflow, { event = null, role = "MANAGER" } = {}) {
  const steps = [];
  const permissions = workflow.permissions ?? {};
  const rolePerms = permissions[role] ?? {
    canStart: String(role) !== "VIEWER",
    canApprove: String(role) === "OWNER" || String(role) === "MANAGER",
  };

  if (event) {
    const triggerResult = evaluateTrigger(workflow.trigger, event);
    steps.push({ kind: "trigger", ...triggerResult });
    if (!triggerResult.matched) {
      return deepFreeze({
        ok: false,
        simulated: true,
        workflowId: workflow.workflowId,
        status: "not_started",
        steps,
        metrics: { stagesVisited: 0 },
      });
    }
  } else {
    steps.push({ kind: "trigger", matched: true, reason: "manual_or_assumed", triggerId: workflow.trigger?.triggerId });
  }

  if (rolePerms.canStart === false) {
    return deepFreeze({
      ok: false,
      simulated: true,
      workflowId: workflow.workflowId,
      status: "denied",
      steps: [...steps, { kind: "permission", ok: false, role }],
      metrics: { stagesVisited: 0 },
    });
  }

  let approvalsPending = 0;
  let escalationsArmed = 0;
  for (const stage of workflow.stages ?? []) {
    steps.push({
      kind: "stage",
      stageId: stage.stageId,
      label: stage.label,
      assignment: stage.assignment,
      actions: stage.actions,
      parallel: Boolean(stage.parallel),
    });
    if (stage.approvalRequired) {
      approvalsPending += 1;
      steps.push({ kind: "approval", stageId: stage.stageId, required: true, approver: stage.assignment });
    }
    for (const action of stage.actions ?? []) {
      steps.push({ kind: "action", stageId: stage.stageId, actionId: action, status: "simulated" });
    }
  }

  for (const escalation of workflow.escalations ?? []) {
    escalationsArmed += 1;
    steps.push({
      kind: "escalation",
      afterHours: escalation.afterHours,
      action: escalation.action,
      to: escalation.to,
      status: "armed",
    });
  }

  steps.push({ kind: "completion", status: "completed" });

  return deepFreeze({
    ok: true,
    simulated: true,
    workflowId: workflow.workflowId,
    version: workflow.version ?? 1,
    status: "completed",
    steps,
    metrics: {
      stagesVisited: (workflow.stages ?? []).length,
      approvalsPending,
      escalationsArmed,
      actionCount: steps.filter((step) => step.kind === "action").length,
    },
    tenantIsolation: { scopedByBusinessId: true, businessId: workflow.businessId ?? null },
  });
}

/**
 * Resolve assignment for a stage given workforce roles / AI employees.
 */
export function resolveAssignment(stage, { organization = null, roleFallback = "manager" } = {}) {
  const target = String(stage?.assignment ?? roleFallback);
  if (target === "ai_employee") {
    const employee = organization?.aiEmployees?.[0] ?? null;
    return deepFreeze({
      kind: "ai_employee",
      assigneeId: employee?.employeeId ?? "ai_coordinator",
      label: employee?.label ?? "AI employee",
    });
  }
  const role = (organization?.humanRoles ?? []).find((entry) => (
    String(entry.roleId) === target
    || String(entry.membershipRole).toLowerCase() === target
    || String(entry.label).toLowerCase().includes(target)
  ));
  return deepFreeze({
    kind: "human",
    assigneeId: role?.roleId ?? target,
    label: role?.label ?? target,
    membershipRole: role?.membershipRole ?? null,
  });
}
