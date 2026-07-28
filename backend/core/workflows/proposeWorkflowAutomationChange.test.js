import test from "node:test";
import assert from "node:assert/strict";

import { proposeWorkflowAutomationChange } from "./proposeWorkflowAutomationChange.js";
import { proposeWorkflowAutomationWithLlm } from "./proposeWorkflowAutomationWithLlm.js";
import { createBlankWorkflow } from "./WorkflowAutomationStore.js";
import { runSingleWorkflow } from "./WorkflowAutomationRunner.js";
import { emptyCrmState } from "../crm/CrmStore.js";
import { WorkRuntime } from "../work/WorkRuntime.js";

test("NL propose builds form → tag + pipeline automation", () => {
  const result = proposeWorkflowAutomationChange({
    instruction: "When a form is submitted, tag vip and add to pipeline Sales",
    pipelines: [
      { id: "pipe_sales", name: "Sales", stages: [{ id: "st_new", label: "New" }] },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.proposedWorkflow.trigger.type, "form_submit");
  const actions = result.proposedWorkflow.steps.filter((s) => s.type === "action").map((s) => s.action);
  assert.ok(actions.includes("tag_contact"));
  assert.ok(actions.includes("add_to_pipeline"));
});

test("NL propose builds if/else and go live", () => {
  const current = createBlankWorkflow({ name: "Router", triggerType: "contact_created" });
  const result = proposeWorkflowAutomationChange({
    instruction: "If contact is lead then create follow-up else tag skipped. Go live.",
    currentWorkflow: current,
  });
  assert.equal(result.ok, true);
  assert.equal(result.proposedWorkflow.status, "live");
  assert.equal(result.proposedWorkflow.steps[0]?.type, "condition");
});

test("NL propose with forceDeterministic LLM wrapper", async () => {
  const result = await proposeWorkflowAutomationWithLlm({
    instruction: "When Meta lead comes in, notify the team",
    forceDeterministic: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.proposedWorkflow.trigger.type, "meta_lead");
  assert.ok(result.proposedWorkflow.steps.some((s) => s.action === "notify_team" || s.type === "action"));
});

test("create_work action writes real work item when WorkRuntime present", async () => {
  const installation = {
    id: "install_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: { crm: emptyCrmState() },
  };
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      installation.configuration = row.configuration;
      return row;
    },
    async getBusinessOSInstallation() {
      return installation;
    },
  };
  const workRuntime = new WorkRuntime({ nowISO: "2026-07-28T12:00:00.000Z" });
  const workflow = {
    id: "wf_work",
    name: "Work maker",
    status: "live",
    trigger: { type: "manual", eventType: "MANUAL_RUN" },
    steps: [
      { type: "action", action: "create_work", params: { title: "Call lead", brief: "Please call" } },
    ],
  };
  const result = await runSingleWorkflow({
    workflow,
    payload: { contact: { name: "Sam", email: "sam@ex.com", kind: "lead" } },
    env: { platformStore, installation, actorId: "test", workRuntime },
  });
  assert.equal(result.ok, true);
  const workLog = result.log.find((l) => l.action === "create_work");
  assert.ok(workLog?.workId);
  assert.ok(workRuntime.getWorkItem(workLog.workId));
});

test("pipeline trigger config skips mismatched stage", async () => {
  const installation = {
    id: "install_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: { crm: emptyCrmState() },
  };
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      installation.configuration = row.configuration;
      return row;
    },
  };
  const workflow = {
    id: "wf_stage",
    name: "Stage only",
    status: "live",
    trigger: {
      type: "pipeline_stage",
      eventType: "PIPELINE_STAGE_ENTERED",
      config: { stageId: "st_won" },
    },
    steps: [
      { type: "action", action: "tag_contact", params: { tags: "won" } },
    ],
  };
  const skipped = await runSingleWorkflow({
    workflow,
    payload: {
      contact: { name: "A", email: "a@ex.com", kind: "lead" },
      pipeline: { id: "p1", stageId: "st_new", stageLabel: "New" },
    },
    env: { platformStore, installation, actorId: "test" },
  });
  assert.equal(skipped.skipped, true);
});
