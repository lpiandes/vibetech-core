import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { WORKFLOW_ACTIONS } from "./WorkflowRegistries.js";

/**
 * Map workflow model → existing Business OS / automation recipe fields.
 * Does not invent a parallel schema.
 */
export function mapWorkflowsToBusinessOS(workflowModel = {}) {
  const workflows = workflowModel.workflows ?? [];

  const workflowDefinitions = workflows.map((workflow) => ({
    workflowId: workflow.workflowId,
    label: workflow.label,
    kind: workflow.kind ?? workflow.category ?? "operations",
    archetypeId: workflow.archetypeId,
    version: workflow.version ?? 1,
    trigger: workflow.trigger?.triggerId ?? null,
    approvalRequired: Boolean(workflow.approvals?.length),
    stageCount: workflow.stages?.length ?? 0,
  }));

  const workDefinitions = uniqueBy(
    workflows.flatMap((workflow) => (
      (workflow.stages ?? [])
        .filter((stage) => (stage.actions ?? []).includes("create_work"))
        .map((stage) => ({
          workType: `${workflow.workflowId}_${stage.stageId}`.toUpperCase(),
          label: `${workflow.label} · ${stage.label}`,
        }))
    )),
    (entry) => entry.workType,
  );

  const requestDefinitions = uniqueBy(
    workflows
      .filter((workflow) => workflow.trigger?.triggerId === "object_created" || workflow.trigger?.triggerId === "communication_received")
      .map((workflow) => ({
        requestType: `${workflow.workflowId}_REQUEST`.toUpperCase(),
        label: `${workflow.label} request`,
      })),
    (entry) => entry.requestType,
  );

  const automationHints = workflows.map((workflow) => ({
    automationId: `auto_${workflow.workflowId}`,
    workflowId: workflow.workflowId,
    triggerEventType: workflow.trigger?.triggerId ?? "manual_start",
    actions: flattenActions(workflow).map((actionId) => ({
      actionId,
      mapsToAutomation: WORKFLOW_ACTIONS[actionId]?.mapsToAutomation ?? null,
      label: WORKFLOW_ACTIONS[actionId]?.label ?? actionId,
    })),
    requiresApproval: Boolean(workflow.approvals?.length),
  }));

  const approvalPolicies = workflows.flatMap((workflow) => (
    (workflow.approvals ?? []).map((approver, index) => ({
      policyId: `ap_${workflow.workflowId}_${index}`,
      workflowId: workflow.workflowId,
      approverRole: approver,
      required: true,
    }))
  ));

  const escalationPolicies = workflows.flatMap((workflow) => (
    (workflow.escalations ?? []).map((escalation, index) => ({
      policyId: `esc_${workflow.workflowId}_${index}`,
      workflowId: workflow.workflowId,
      afterHours: escalation.afterHours,
      escalateTo: escalation.to,
      action: escalation.action ?? "escalate",
    }))
  ));

  return deepFreeze({
    workflowDefinitions,
    workDefinitions,
    requestDefinitions,
    automationHints,
    approvalPolicies,
    escalationPolicies,
    tenantIsolation: {
      scopedByBusinessId: true,
      noCrossTenantRuns: true,
      businessId: workflowModel.businessId ?? null,
    },
  });
}

function flattenActions(workflow) {
  const ids = [];
  for (const stage of workflow.stages ?? []) {
    for (const action of stage.actions ?? []) {
      if (!ids.includes(action)) ids.push(action);
    }
  }
  return ids;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
