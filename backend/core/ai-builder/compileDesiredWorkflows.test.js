import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compileDesiredWorkflows,
  compileWorkflowChainToPath,
} from "./compileDesiredWorkflows.js";
import { executeSpecialtyPathSteps } from "./specialty/executeSpecialtyPathSteps.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";

test("compileDesiredWorkflows turns FB lead chain into email + sms + pipeline path", () => {
  const workflows = compileDesiredWorkflows({
    businessSummary: {
      primaryWorkflow: "FB lead comes in -> email -> sms -> update pipeline",
    },
  });
  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].archetypeId, "facebook_lead_specialist");
  assert.ok(workflows[0].trigger.eventTypes.includes("META_LEAD"));
  const types = workflows[0].automationPath.steps
    .filter((step) => step.enabled !== false)
    .map((step) => step.type);
  assert.deepEqual(types, ["create_draft", "send_email", "send_sms", "add_to_pipeline"]);
  assert.equal(workflows[0].automationPath.customized, true);
});

test("compileDesiredWorkflows splits multiple listed processes", () => {
  const workflows = compileDesiredWorkflows({
    answers: [{
      questionId: "q_desired_workflows",
      answer: "Calendar change -> email parents\nNew inquiry -> SMS -> pipeline",
    }],
  });
  assert.equal(workflows.length, 2);
  assert.ok(workflows[0].trigger.eventTypes.includes("SCHEDULE_CHANGE"));
  assert.ok(workflows[1].automationPath.steps.some((step) => step.type === "send_sms"));
});

test("executeSpecialtyPathSteps returns notes for default path when contract path missing", async () => {
  const result = await executeSpecialtyPathSteps({
    employee: {
      employeeId: "emp_test",
      operatingContract: {
        scope: { answers: { where: { value: "Email and SMS" } } },
      },
    },
  });
  assert.equal(result.ok, true);
  assert.ok(result.notes.length >= 2, "expected draft + channel notes");
  assert.ok(result.notes.some((note) => note.type === "send_email" && note.deferred));
  assert.ok(result.notes.some((note) => note.type === "send_sms" && note.deferred));
});

test("assembly planner attaches process automations from discovery answer", () => {
  const planner = new BuilderAssemblyPlanner();
  const plan = planner.plan({
    session: {
      businessSummary: {
        industry: "sports",
        businessName: "Top Gun",
        desiredWorkforce: "Intake coordinator",
        primaryWorkflow: "FB lead comes in -> email -> SMS -> update pipeline",
      },
      answers: [
        { questionId: "q_digital_workforce", answer: "Intake coordinator" },
        { questionId: "q_desired_workflows", answer: "FB lead comes in -> email -> SMS -> update pipeline" },
      ],
      evidence: [],
    },
  });
  assert.equal(plan.ok, true);
  assert.ok(plan.desiredWorkflows.length >= 1);
  const withPath = plan.selectedEmployees.find((entry) => (
    entry.payload?.employee?.automationPath?.customized
  ));
  assert.ok(withPath, "expected a selected employee with customized automation path");
  const types = withPath.payload.employee.automationPath.steps
    .filter((step) => step.enabled !== false)
    .map((step) => step.type);
  assert.ok(types.includes("send_email"));
  assert.ok(types.includes("send_sms"));
  assert.ok(types.includes("add_to_pipeline"));
});

test("compileWorkflowChainToPath supports arrow chains for AI composer", () => {
  const result = compileWorkflowChainToPath("form submit -> email -> notify team");
  assert.equal(result.ok, true);
  assert.ok(result.proposedPath.steps.some((step) => step.type === "send_email"));
  assert.ok(result.proposedPath.steps.some((step) => step.type === "notify_team" && step.enabled !== false));
});
