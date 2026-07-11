/**
 * Pure Workflow workspace projection — no React.
 * Prefers Business OS mapping / workflow model; falls back to thin workflowDefinitions.
 *
 * @param {{
 *   configuration?: Record<string, any> | null,
 *   workflowModel?: Record<string, any> | null,
 *   businessOsMapping?: Record<string, any> | null,
 *   workItems?: Array<Record<string, any>>,
 * }} [args]
 */
export function composeWorkflowView({
  configuration = null,
  workflowModel = null,
  businessOsMapping = null,
  workItems = /** @type {Array<Record<string, any>>} */ ([]),
} = {}) {
  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const mapping = businessOsMapping ?? configuration?.workflows ?? null;
  const model = workflowModel ?? null;

  const workflows = model?.workflows?.length
    ? model.workflows.map((workflow) => ({
      id: String(workflow.workflowId),
      label: String(workflow.label),
      archetypeId: workflow.archetypeId ?? null,
      status: String(workflow.status ?? "recommended"),
      trigger: workflow.trigger?.triggerId ?? null,
      stageCount: asArray(workflow.stages).length,
      approvalCount: asArray(workflow.approvals).length,
      escalationCount: asArray(workflow.escalations).length,
      stages: asArray(workflow.stages).map((stage) => ({
        id: stage.stageId,
        label: stage.label,
        assignment: stage.resolvedAssignment?.label ?? stage.assignment,
        approvalRequired: Boolean(stage.approvalRequired),
        actions: asArray(stage.actions),
      })),
      version: workflow.version ?? 1,
    }))
    : asArray(mapping?.workflowDefinitions ?? configuration?.workflowDefinitions).map((entry) => ({
      id: String(entry.workflowId ?? entry.id),
      label: String(entry.label ?? entry.workflowId ?? "Workflow"),
      archetypeId: entry.archetypeId ?? null,
      status: "installed",
      trigger: entry.trigger ?? null,
      stageCount: Number(entry.stageCount ?? 0),
      approvalCount: entry.approvalRequired ? 1 : 0,
      escalationCount: 0,
      stages: [],
      version: entry.version ?? 1,
    }));

  const pendingApprovals = workflows
    .filter((workflow) => workflow.approvalCount > 0)
    .map((workflow) => ({
      id: `approval_${workflow.id}`,
      label: `${workflow.label} approval`,
      workflowId: workflow.id,
      status: "pending",
    }));

  const automations = asArray(mapping?.automationHints ?? model?.workflows).map((entry, index) => {
    if (entry.automationId) {
      return {
        id: String(entry.automationId),
        label: String(entry.workflowId ?? entry.automationId),
        status: entry.requiresApproval ? "approval_gated" : "armed",
        trigger: entry.triggerEventType ?? null,
      };
    }
    return {
      id: `auto_${entry.workflowId ?? index}`,
      label: String(entry.label ?? entry.workflowId ?? "Automation"),
      status: asArray(entry.approvals).length ? "approval_gated" : "armed",
      trigger: entry.trigger?.triggerId ?? null,
    };
  });

  const activeFromWork = asArray(workItems)
    .filter((item) => String(item.status ?? "").toUpperCase() !== "COMPLETED")
    .slice(0, 12)
    .map((item) => ({
      id: String(item.id ?? item.workItemId),
      label: String(item.title ?? item.label ?? "Work"),
      status: String(item.status ?? "OPEN"),
      kind: "work",
    }));

  const history = workflows.map((workflow) => ({
    id: `hist_${workflow.id}`,
    label: workflow.label,
    detail: `v${workflow.version} · ${workflow.trigger ?? "manual"} · ${workflow.stageCount} stages`,
  }));

  const hasWorkflows = workflows.length > 0 || activeFromWork.length > 0;

  return {
    hasWorkflows,
    workflows,
    active: activeFromWork.length
      ? activeFromWork
      : workflows.slice(0, 6).map((workflow) => ({
        id: workflow.id,
        label: workflow.label,
        status: workflow.status,
        kind: "workflow",
      })),
    pendingApprovals,
    automations,
    history,
    performance: [
      { id: "workflows", label: "Workflows", value: workflows.length },
      { id: "approvals", label: "Pending approvals", value: pendingApprovals.length },
      { id: "automations", label: "Automations", value: automations.length },
      { id: "active", label: "Active", value: activeFromWork.length || workflows.length },
    ],
    metrics: [
      { id: "workflows", label: "Workflows", value: workflows.length },
      { id: "approvals", label: "Approvals", value: pendingApprovals.length },
      { id: "automations", label: "Automations", value: automations.length },
      { id: "stages", label: "Stages", value: workflows.reduce((sum, entry) => sum + entry.stageCount, 0) },
    ],
  };
}
