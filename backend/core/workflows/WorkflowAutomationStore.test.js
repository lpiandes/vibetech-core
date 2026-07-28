import test from "node:test";
import assert from "node:assert/strict";

import {
  createBlankWorkflow,
  emptyWorkflowState,
  upsertWorkflow,
  listLiveWorkflowsForEvent,
  normalizeWorkflow,
} from "./WorkflowAutomationStore.js";
import {
  evaluateRule,
  evaluateConditionStep,
  runSingleWorkflow,
} from "./WorkflowAutomationRunner.js";
import { emptyCrmState } from "../crm/CrmStore.js";

test("condition rules support equals contains and OR logic", () => {
  const ctx = { contact: { kind: "lead", tags: ["vip", "import"], email: "a@b.com" } };
  assert.equal(evaluateRule({ field: "contact.kind", op: "equals", value: "lead" }, ctx), true);
  assert.equal(evaluateRule({ field: "contact.tags", op: "contains", value: "vip" }, ctx), true);
  assert.equal(evaluateRule({ field: "contact.email", op: "exists", value: "" }, ctx), true);
  assert.equal(
    evaluateConditionStep({
      logic: "or",
      rules: [
        { field: "contact.kind", op: "equals", value: "client" },
        { field: "contact.kind", op: "equals", value: "lead" },
      ],
    }, ctx),
    true,
  );
});

test("listLiveWorkflowsForEvent only returns live matching triggers", () => {
  let state = emptyWorkflowState();
  state = upsertWorkflow(state, createBlankWorkflow({ name: "A", triggerType: "form_submit" }));
  state = upsertWorkflow(state, {
    ...createBlankWorkflow({ name: "B", triggerType: "meta_lead" }),
    status: "live",
  });
  const liveForm = listLiveWorkflowsForEvent(
    { ...state, workflows: state.workflows.map((w) => w.name === "A" ? { ...w, status: "live" } : w) },
    "FORM_SUBMIT",
  );
  assert.ok(liveForm.some((w) => w.name === "A"));
  assert.equal(liveForm.some((w) => w.name === "B"), false);
});

test("runSingleWorkflow applies then-branch and tags contact", async () => {
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

  const workflow = normalizeWorkflow({
    name: "Lead router",
    status: "live",
    trigger: { type: "contact_created" },
    steps: [
      {
        type: "condition",
        logic: "and",
        rules: [{ field: "contact.kind", op: "equals", value: "lead" }],
        thenSteps: [
          { type: "action", action: "tag_contact", params: { tags: "hot_lead" } },
          {
            type: "action",
            action: "add_to_pipeline",
            params: {},
          },
        ],
        elseSteps: [
          { type: "action", action: "tag_contact", params: { tags: "not_lead" } },
        ],
      },
    ],
  });

  const result = await runSingleWorkflow({
    workflow,
    payload: {
      contact: { name: "Alex", email: "alex@ex.com", kind: "lead" },
      eventType: "CONTACT_CREATED",
    },
    env: { platformStore, installation, actorId: "test" },
  });

  assert.equal(result.ok, true);
  const contact = installation.configuration.crm.contacts.find((c) => c.email === "alex@ex.com");
  assert.ok(contact);
  assert.ok(contact.tags.includes("hot_lead"));
  assert.ok((installation.configuration.crm.pipelines[0].cards ?? []).length >= 1);
});

test("run_workflow chains into another automation", async () => {
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

  const child = normalizeWorkflow({
    id: "wf_child",
    name: "Child",
    status: "live",
    trigger: { type: "manual" },
    steps: [
      { type: "action", action: "tag_contact", params: { tags: "from_child" } },
    ],
  });
  const parent = normalizeWorkflow({
    id: "wf_parent",
    name: "Parent",
    status: "live",
    trigger: { type: "manual" },
    steps: [
      { type: "action", action: "run_workflow", params: { workflowId: "wf_child" } },
    ],
  });
  installation.configuration.workflows = {
    version: 1,
    workflows: [parent, child],
    updatedAt: null,
  };

  // Seed contact first
  await runSingleWorkflow({
    workflow: normalizeWorkflow({
      name: "seed",
      status: "live",
      trigger: { type: "manual" },
      steps: [{ type: "action", action: "tag_contact", params: { tags: "seed" } }],
    }),
    payload: { contact: { name: "Pat", email: "pat@ex.com", kind: "lead" } },
    env: { platformStore, installation, actorId: "test" },
  });

  const result = await runSingleWorkflow({
    workflow: parent,
    payload: { contact: { name: "Pat", email: "pat@ex.com", kind: "lead" } },
    env: { platformStore, installation, actorId: "test" },
  });
  assert.equal(result.ok, true);
  const contact = installation.configuration.crm.contacts.find((c) => c.email === "pat@ex.com");
  assert.ok(contact.tags.includes("from_child"));
});
