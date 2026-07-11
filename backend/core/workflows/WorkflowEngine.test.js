import assert from "node:assert/strict";
import { test } from "node:test";

import { WorkflowEngine } from "./WorkflowEngine.js";
import { mapWorkflowsToBusinessOS } from "./mapWorkflowsToBusinessOS.js";
import {
  listActionIds,
  listTriggerIds,
  isKnownTrigger,
  isKnownAction,
} from "./WorkflowRegistries.js";
import {
  listWorkflowArchetypeIds,
  resolveWorkflowTemplate,
} from "./WorkflowArchetypeCatalog.js";
import { evaluateTrigger, simulateWorkflow } from "./WorkflowRuntimeHelpers.js";
import { WorkflowRecommendationEngine } from "../ai-builder/WorkflowRecommendationEngine.js";
import { WorkflowGenerationStage } from "../architect/ArchitectMatchingStages.js";
import { createBlueprintDefinition } from "../blueprints/BlueprintDefinition.js";

test("workflow generation uses reusable archetypes across industries", () => {
  const engine = new WorkflowEngine();
  for (const industry of ["property_management", "dental", "sports", "default"]) {
    const result = engine.recommendWorkflows({ businessSummary: { industry } });
    assert.equal(result.ok, true);
    assert.ok(result.workflowModel.workflows.length >= 4, industry);
    for (const workflow of result.workflowModel.workflows) {
      assert.ok(listWorkflowArchetypeIds().includes(workflow.archetypeId));
      assert.ok(workflow.stages.length >= 2);
      assert.ok(isKnownTrigger(workflow.trigger.triggerId));
    }
  }
});

test("trigger evaluation matches and rejects correctly", () => {
  const trigger = { triggerId: "object_created", objectType: "patient", conditions: [] };
  assert.equal(evaluateTrigger(trigger, { type: "object_created", objectType: "patient" }).matched, true);
  assert.equal(evaluateTrigger(trigger, { type: "object_updated", objectType: "patient" }).matched, false);
  assert.equal(evaluateTrigger(trigger, { type: "object_created", objectType: "invoice" }).matched, false);
  assert.ok(listTriggerIds().includes("approval_completed"));
  assert.ok(listTriggerIds().includes("recurring_schedule"));
});

test("assignment resolves human and AI targets", () => {
  const engine = new WorkflowEngine();
  const human = engine.resolveAssignment(
    { assignment: "manager" },
    { organization: { humanRoles: [{ roleId: "manager", label: "Office Manager", membershipRole: "MANAGER" }], aiEmployees: [] } },
  );
  assert.equal(human.kind, "human");
  assert.equal(human.label, "Office Manager");

  const ai = engine.resolveAssignment(
    { assignment: "ai_employee" },
    { organization: { humanRoles: [], aiEmployees: [{ employeeId: "ai_1", label: "Scheduler" }] } },
  );
  assert.equal(ai.kind, "ai_employee");
  assert.equal(ai.label, "Scheduler");
});

test("approvals and escalations are recommended", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "dental" },
  });
  assert.ok(result.recommendations.some((entry) => entry.kind === "approval"));
  assert.ok(result.recommendations.some((entry) => entry.kind === "escalation"));
  assert.ok(result.workflowModel.workflows.some((entry) => entry.approvals.length > 0));
  assert.ok(result.workflowModel.workflows.some((entry) => entry.escalations.length > 0));
});

test("automation recommendations include known actions", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "default" },
  });
  assert.ok(result.recommendations.some((entry) => entry.kind === "automation"));
  for (const workflow of result.workflowModel.workflows) {
    for (const stage of workflow.stages) {
      for (const action of stage.actions) {
        assert.ok(isKnownAction(action), action);
      }
    }
  }
  assert.ok(listActionIds().includes("create_work"));
  assert.ok(listActionIds().includes("run_ai_employee"));
});

test("versioning bumps workflow version", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "sports" },
  });
  const original = result.workflowModel.workflows[0];
  const next = new WorkflowEngine().versionWorkflow(original, { changeReason: "sla tweak" });
  assert.equal(next.version, (original.version ?? 1) + 1);
  assert.equal(next.previousVersion, original.version ?? 1);
  assert.equal(next.workflowId, original.workflowId);
});

test("simulation walks stages without mutating tenant state", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "property_management" },
    businessId: "biz_sim",
  });
  const workflow = result.workflowModel.workflows[0];
  const sim = simulateWorkflow(workflow, {
    event: { type: workflow.trigger.triggerId, objectType: workflow.trigger.objectType },
    role: "MANAGER",
  });
  assert.equal(sim.ok, true);
  assert.equal(sim.simulated, true);
  assert.ok(sim.steps.some((step) => step.kind === "stage"));
  assert.ok(sim.steps.some((step) => step.kind === "completion"));
  assert.ok(sim.metrics.stagesVisited >= 1);

  const denied = simulateWorkflow(workflow, { role: "VIEWER" });
  assert.equal(denied.status, "denied");
});

test("role permissions differ by membership role", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "default" },
  });
  assert.equal(result.workflowModel.permissions.OWNER.canCancel, true);
  assert.equal(result.workflowModel.permissions.VIEWER.canStart, false);
  assert.equal(result.workflowModel.permissions.EMPLOYEE.canApprove, false);
});

test("every recommendation includes reason confidence evidence alternatives", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "sports" },
  });
  assert.ok(result.recommendations.length >= 8);
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.reason || recommendation.why);
    assert.equal(typeof recommendation.confidence, "number");
    assert.ok(Array.isArray(recommendation.evidence));
    assert.ok(Array.isArray(recommendation.alternatives));
  }
});

test("mapWorkflowsToBusinessOS fills existing Business OS fields", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "dental" },
    businessId: "biz_dental",
  });
  const mapped = mapWorkflowsToBusinessOS(result.workflowModel);
  assert.ok(mapped.workflowDefinitions.length >= 4);
  assert.ok(mapped.workDefinitions.length >= 1);
  assert.ok(mapped.automationHints.length >= 1);
  assert.equal(mapped.tenantIsolation.scopedByBusinessId, true);
});

test("blueprint reuse — workflowDefinitions fit blueprint recipe shape", () => {
  const result = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "default" },
  });
  const mapped = result.businessOsMapping;
  const blueprint = createBlueprintDefinition({
    blueprintId: "bp_workflow_reuse_test",
    name: "Workflow reuse",
    industry: "generic",
    maturity: "experimental",
    workRecipes: mapped.workDefinitions.map((entry) => ({
      workType: entry.workType,
      label: entry.label,
    })),
  });
  assert.ok(blueprint.workRecipes.length >= 1);
});

test("multi-industry generation differs without separate engines", () => {
  const pm = resolveWorkflowTemplate("property_management");
  const dental = resolveWorkflowTemplate("dental");
  const sports = resolveWorkflowTemplate("sports");
  assert.ok(pm.workflows.some((entry) => entry.workflowId === "prospect_intake"));
  assert.ok(dental.workflows.some((entry) => entry.workflowId === "patient_intake"));
  assert.ok(sports.workflows.some((entry) => entry.workflowId === "player_registration"));
});

test("tenant isolation is explicit on model and mapping", () => {
  const a = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "default" },
    businessId: "biz_a",
  });
  const b = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "default" },
    businessId: "biz_b",
  });
  assert.equal(a.workflowModel.tenantIsolation.businessId, "biz_a");
  assert.equal(b.workflowModel.tenantIsolation.businessId, "biz_b");
  assert.notEqual(a.businessOsMapping.tenantIsolation.businessId, b.businessOsMapping.tenantIsolation.businessId);
});

test("WorkflowRecommendationEngine facade preserves workflow recommendations", () => {
  const facade = new WorkflowRecommendationEngine();
  const result = facade.recommend({ businessSummary: { industry: "dental" } });
  assert.equal(result.ok, true);
  assert.ok(result.recommendations.length >= 2);
  assert.ok(result.workflowModel.workflows.length >= 2);
  assert.ok(result.recommendations.every((entry) => entry.kind === "workflow"));
});

test("Architect workflow_generation stage outputs workflow model", () => {
  const stage = new WorkflowGenerationStage();
  const result = stage.generate({
    dna: {
      company: { industry: "sports", whatTheyDo: "Travel hockey" },
      workflows: [{ label: "Travel approval" }],
    },
    businessId: "biz_hockey",
  });
  assert.equal(result.stageId, "workflow_generation");
  assert.ok(result.outputs.workflows.length >= 1);
  assert.ok(result.outputs.workflowModel.workflows.length >= 1);
  assert.ok(result.outputs.businessOsMapping.workflowDefinitions.length >= 1);
});

test("missing archetype recommends reusable archetype not one-off", () => {
  const known = new Set(listWorkflowArchetypeIds());
  assert.equal(known.has("one_off_custom_flow"), false);
  assert.ok(known.has("intake_to_work"));
  assert.ok(known.has("approval_gated"));
});
