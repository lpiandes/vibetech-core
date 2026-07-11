import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  WORKFLOW_CONTROL_OPS,
  WORKFLOW_FEATURES,
  isKnownAction,
  isKnownTrigger,
  listActionIds,
  listTriggerIds,
} from "./WorkflowRegistries.js";
import {
  getWorkflowArchetype,
  listWorkflowArchetypeIds,
  resolveWorkflowTemplate,
} from "./WorkflowArchetypeCatalog.js";
import { createWorkflowRecommendation } from "./WorkflowRecommendation.js";
import { mapWorkflowsToBusinessOS } from "./mapWorkflowsToBusinessOS.js";
import {
  evaluateTrigger,
  resolveAssignment,
  simulateWorkflow,
} from "./WorkflowRuntimeHelpers.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function industryOf({ dna = null, businessSummary = {} } = {}) {
  return String(
    businessSummary.industry
    ?? dna?.company?.industry
    ?? "default",
  );
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\W+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "workflow";
}

/**
 * Universal Workflow & Automation Engine — one system every business uses.
 * Generates workflows, stages, triggers, assignments, approvals, escalations, automations.
 */
export class WorkflowEngine {
  recommendWorkflows({
    dna = null,
    businessSummary = {},
    evidence = [],
    businessId = null,
    organization = null,
  } = {}) {
    const industry = industryOf({ dna, businessSummary });
    const template = resolveWorkflowTemplate(industry);
    const known = new Set(listWorkflowArchetypeIds());
    const baseEvidence = [
      `industry:${industry}`,
      ...asArray(evidence).map(String),
      ...(dna ? ["source:business_dna"] : ["source:business_summary"]),
      ...(businessId ? [`tenant:${businessId}`] : ["tenant:preview"]),
    ];

    const recommendations = [];
    const gaps = [];
    const workflows = [];

    const dnaPicks = inferWorkflowsFromDna(dna);
    const picks = dnaPicks.length
      ? mergeTemplateWithDna(template.workflows, dnaPicks)
      : template.workflows.map((entry) => ({ ...entry }));

    for (const pick of picks) {
      if (!known.has(pick.archetypeId)) {
        gaps.push({
          kind: "reusable_workflow_archetype_needed",
          label: `Missing workflow archetype: ${pick.archetypeId}`,
          requestedOutcome: pick.label,
          recommendation: "Register a reusable workflow archetype — do not invent a one-off workflow.",
        });
        recommendations.push(createWorkflowRecommendation({
          recommendationId: `rec_gap_wf_${pick.archetypeId}`,
          kind: "workflow_archetype_gap",
          label: `Propose archetype: ${pick.label}`,
          reason: `No reusable workflow archetype matches "${pick.archetypeId}". Recommend registering a reusable archetype instead of a one-off workflow.`,
          confidence: 0.55,
          evidence: [...baseEvidence, `missing_archetype:${pick.archetypeId}`],
          alternatives: suggestAlternativeArchetypes(pick.archetypeId),
          payload: { requested: pick },
          selected: false,
        }));
        continue;
      }

      const workflow = buildWorkflowDefinition(pick, { businessId, organization });
      workflows.push(workflow);

      recommendations.push(createWorkflowRecommendation({
        recommendationId: `rec_workflow_${workflow.workflowId}`,
        kind: "workflow",
        label: workflow.label,
        reason: `Automate ${workflow.label} with reusable archetype "${workflow.archetypeId}" so work, approvals, and escalations stay governed.`,
        confidence: dnaPicks.length ? 0.9 : 0.82,
        evidence: [...baseEvidence, `archetype:${workflow.archetypeId}`, `trigger:${workflow.trigger.triggerId}`],
        alternatives: workflows
          .filter((entry) => entry.workflowId !== workflow.workflowId)
          .slice(0, 2)
          .map((entry) => entry.label),
        payload: { workflow },
        selected: true,
      }));

      for (const stage of workflow.stages) {
        recommendations.push(createWorkflowRecommendation({
          recommendationId: `rec_stage_${workflow.workflowId}_${stage.stageId}`,
          kind: "stage",
          label: `${workflow.label} · ${stage.label}`,
          reason: `Stage "${stage.label}" moves the workflow forward with clear assignment and actions.`,
          confidence: 0.84,
          evidence: [...baseEvidence, `stage:${stage.stageId}`, `assignment:${stage.assignment}`],
          alternatives: workflow.stages
            .filter((entry) => entry.stageId !== stage.stageId)
            .slice(0, 2)
            .map((entry) => entry.label),
          payload: { workflowId: workflow.workflowId, stage },
          selected: true,
        }));

        recommendations.push(createWorkflowRecommendation({
          recommendationId: `rec_assign_${workflow.workflowId}_${stage.stageId}`,
          kind: "assignment",
          label: `Assign ${stage.label}`,
          reason: `Route ${stage.label} to ${stage.resolvedAssignment?.label ?? stage.assignment} so ownership is explicit.`,
          confidence: 0.8,
          evidence: [...baseEvidence, `assignee:${stage.resolvedAssignment?.assigneeId ?? stage.assignment}`],
          alternatives: ["manager", "owner", "ai_employee", "coordinator"],
          payload: { workflowId: workflow.workflowId, assignment: stage.resolvedAssignment },
          selected: true,
        }));
      }

      for (const approval of workflow.approvals) {
        recommendations.push(createWorkflowRecommendation({
          recommendationId: `rec_approval_${workflow.workflowId}_${approval}`,
          kind: "approval",
          label: `${workflow.label} approval · ${approval}`,
          reason: `Require ${approval} approval before customer-facing or irreversible actions proceed.`,
          confidence: 0.86,
          evidence: [...baseEvidence, `approver:${approval}`],
          alternatives: ["manager", "owner"],
          payload: { workflowId: workflow.workflowId, approver: approval },
          selected: true,
        }));
      }

      for (const escalation of workflow.escalations) {
        recommendations.push(createWorkflowRecommendation({
          recommendationId: `rec_esc_${workflow.workflowId}_${escalation.afterHours}`,
          kind: "escalation",
          label: `${workflow.label} escalate @ ${escalation.afterHours}h`,
          reason: `Escalate to ${escalation.to} after ${escalation.afterHours}h so SLAs do not silently fail.`,
          confidence: 0.83,
          evidence: [...baseEvidence, `sla_hours:${escalation.afterHours}`],
          alternatives: ["manager", "owner"],
          payload: { workflowId: workflow.workflowId, escalation },
          selected: true,
        }));
      }

      recommendations.push(createWorkflowRecommendation({
        recommendationId: `rec_auto_${workflow.workflowId}`,
        kind: "automation",
        label: `Automate ${workflow.label}`,
        reason: `Wire trigger "${workflow.trigger.triggerId}" to governed actions so humans only intervene on approvals and exceptions.`,
        confidence: 0.81,
        evidence: [...baseEvidence, `actions:${workflow.stages.flatMap((s) => s.actions).length}`],
        alternatives: ["manual_start only", "approval-gated only", "full automation"],
        payload: {
          workflowId: workflow.workflowId,
          trigger: workflow.trigger,
          actions: workflow.stages.flatMap((stage) => stage.actions),
        },
        selected: true,
      }));
    }

    const workflowModel = {
      industry,
      businessId: businessId ?? null,
      version: 1,
      workflows,
      features: [...WORKFLOW_FEATURES],
      controlOps: [...WORKFLOW_CONTROL_OPS],
      supportedTriggers: listTriggerIds(),
      supportedActions: listActionIds(),
      permissions: buildRolePermissions(workflows),
      tenantIsolation: {
        scopedByBusinessId: true,
        businessId: businessId ?? null,
        noCrossTenantRuns: true,
      },
      history: [],
      metrics: {
        workflowCount: workflows.length,
        approvalGated: workflows.filter((entry) => entry.approvals.length).length,
        withEscalations: workflows.filter((entry) => entry.escalations.length).length,
      },
    };

    const businessOsMapping = mapWorkflowsToBusinessOS(workflowModel);

    return deepFreeze({
      ok: true,
      workflowModel,
      recommendations,
      gaps,
      businessOsMapping,
      workflows: recommendations.filter((entry) => entry.kind === "workflow"),
    });
  }

  evaluateTrigger(trigger, event) {
    return evaluateTrigger(trigger, event);
  }

  simulate(workflow, options = {}) {
    return simulateWorkflow(workflow, options);
  }

  resolveAssignment(stage, options = {}) {
    return resolveAssignment(stage, options);
  }

  /**
   * Bump workflow version while preserving identity — for governed changes.
   */
  versionWorkflow(workflow, { changeReason = "revision" } = {}) {
    const nextVersion = Number(workflow.version ?? 1) + 1;
    return deepFreeze({
      ...workflow,
      version: nextVersion,
      previousVersion: workflow.version ?? 1,
      changeReason: String(changeReason),
      versionedAt: new Date().toISOString(),
    });
  }
}

function buildWorkflowDefinition(pick, { businessId, organization }) {
  const archetype = getWorkflowArchetype(pick.archetypeId);
  const triggerId = pick.trigger ?? archetype.defaultTrigger;
  const stages = archetype.stages.map((stage) => {
    const resolvedAssignment = resolveAssignment(stage, { organization });
    return {
      ...stage,
      actions: (stage.actions ?? []).filter((actionId) => isKnownAction(actionId)),
      resolvedAssignment,
    };
  });

  return {
    workflowId: pick.workflowId,
    label: pick.label,
    archetypeId: pick.archetypeId,
    category: archetype.category,
    kind: archetype.category,
    version: 1,
    businessId: businessId ?? null,
    trigger: {
      triggerId: isKnownTrigger(triggerId) ? triggerId : "manual_start",
      objectType: pick.objectHint ?? null,
      conditions: [],
    },
    stages,
    approvals: [...(archetype.approvals ?? [])],
    escalations: [...(archetype.escalations ?? [])],
    features: [...(archetype.features ?? ["stages"]), "versioning", "simulation"],
    controlOps: [...WORKFLOW_CONTROL_OPS],
    status: "recommended",
    permissions: {
      OWNER: { canStart: true, canApprove: true, canCancel: true, canSimulate: true },
      MANAGER: { canStart: true, canApprove: true, canCancel: true, canSimulate: true },
      EMPLOYEE: { canStart: true, canApprove: false, canCancel: false, canSimulate: true },
      VIEWER: { canStart: false, canApprove: false, canCancel: false, canSimulate: true },
    },
    metrics: {
      stageCount: stages.length,
      actionCount: stages.reduce((sum, stage) => sum + stage.actions.length, 0),
      slaTracked: stages.some((stage) => stage.slaHours != null),
    },
  };
}

function buildRolePermissions(workflows) {
  const ids = workflows.map((entry) => entry.workflowId);
  return {
    OWNER: { workflows: ids, canStart: true, canApprove: true, canCancel: true, canSimulate: true },
    MANAGER: { workflows: ids, canStart: true, canApprove: true, canCancel: true, canSimulate: true },
    EMPLOYEE: { workflows: ids, canStart: true, canApprove: false, canCancel: false, canSimulate: true },
    VIEWER: { workflows: ids, canStart: false, canApprove: false, canCancel: false, canSimulate: true },
  };
}

function inferWorkflowsFromDna(dna) {
  if (!dna) return [];
  return asArray(dna.workflows).map((entry) => {
    const label = entry.label ?? entry.name ?? "Workflow";
    return {
      archetypeId: guessArchetypeFromLabel(label),
      workflowId: slug(entry.workflowId ?? label),
      label,
      trigger: guessTriggerFromLabel(label),
    };
  });
}

function mergeTemplateWithDna(templateWorkflows, dnaWorkflows) {
  const byId = new Map();
  for (const entry of templateWorkflows) {
    byId.set(entry.workflowId, { ...entry });
  }
  for (const entry of dnaWorkflows) {
    if (!byId.has(entry.workflowId)) {
      byId.set(entry.workflowId, entry);
    } else {
      byId.set(entry.workflowId, { ...byId.get(entry.workflowId), label: entry.label });
    }
  }
  return [...byId.values()];
}

function guessArchetypeFromLabel(label) {
  const text = String(label).toLowerCase();
  if (/approv|campaign|send/.test(text)) return "approval_gated";
  if (/follow.?up|recall|nurture/.test(text)) return "follow_up_loop";
  if (/sla|escalat|overdue/.test(text)) return "sla_escalation";
  if (/complet|close|done/.test(text)) return "work_completion";
  if (/inbox|message|communication/.test(text)) return "communication_intake";
  if (/report|kpi|digest/.test(text)) return "scheduled_report";
  if (/integrat|sync|webhook/.test(text)) return "integration_sync";
  return "intake_to_work";
}

function guessTriggerFromLabel(label) {
  const text = String(label).toLowerCase();
  if (/follow.?up|sla|elapsed/.test(text)) return "time_elapsed";
  if (/recall|renew|date/.test(text)) return "date_reached";
  if (/approv|campaign/.test(text)) return "manual_start";
  if (/complet/.test(text)) return "work_completed";
  if (/inbox|message/.test(text)) return "communication_received";
  if (/report|weekly|daily/.test(text)) return "recurring_schedule";
  return "object_created";
}

function suggestAlternativeArchetypes(missingId) {
  const known = listWorkflowArchetypeIds();
  const token = String(missingId).split("_")[0];
  const hits = known.filter((id) => id.includes(token)).slice(0, 3);
  return hits.length ? hits : known.slice(0, 3);
}
