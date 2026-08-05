import test from "node:test";
import assert from "node:assert/strict";

import { proposeAutomationWithLlm } from "./proposeAutomationWithLlm.js";
import { proposeAutomationPathChange } from "./proposeAutomationPathChange.js";
import { emitSpecialtyBusinessEvent } from "./emitSpecialtyBusinessEvent.js";
import { executeSpecialtyPathSteps } from "./executeSpecialtyPathSteps.js";
import { emptyCrmState } from "../../crm/CrmStore.js";
import { PATH_STEP_TYPES } from "../operating-contract/automationPath.js";

test("deterministic proposer still adds email from plain English", () => {
  const proposal = proposeAutomationPathChange({
    instruction: 'Add an email to the team with subject "New signup"',
    contract: { automationPath: { version: 1, customized: true, steps: [] } },
  });
  assert.equal(proposal.ok, true);
  assert.ok(proposal.proposedPath.steps.some((s) => s.type === PATH_STEP_TYPES.SEND_EMAIL));
});

test("LLM proposer falls back to deterministic when forceDeterministic", async () => {
  const result = await proposeAutomationWithLlm({
    instruction: 'Add an email to the team with subject "Welcome"',
    contract: { automationPath: { version: 1, customized: true, steps: [] } },
    forceDeterministic: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, "deterministic");
  assert.ok(result.proposedPath.steps.some((s) => s.type === "send_email"));
});

test("LLM proposer uses mock provider JSON for path + trigger", async () => {
  const mockProvider = {
    async generate() {
      return JSON.stringify({
        summary: "Pipeline stage fires draft email",
        notes: ["set_trigger", "add_email"],
        trigger: {
          mode: "events",
          eventTypes: ["PIPELINE_STAGE_ENTERED"],
          summary: "When a pipeline stage changes",
        },
        automationPath: {
          steps: [
            {
              id: "step_1",
              type: "create_draft",
              label: "Draft follow-up",
              enabled: true,
              order: 0,
            },
            {
              id: "step_2",
              type: "send_email",
              label: "Email team",
              audience: "team",
              subject: "Stage update",
              body: "A card moved stages.",
              requiresApproval: true,
              enabled: true,
              order: 1,
            },
          ],
        },
      });
    },
  };

  const result = await proposeAutomationWithLlm({
    instruction: "When a pipeline stage changes, draft an email to the team",
    contract: {},
    industry: "professional_services",
    pipelines: [{ id: "p1", name: "Intake", stages: [{ id: "s1", label: "New" }] }],
    llmProvider: mockProvider,
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "llm");
  assert.ok(result.proposedTrigger.eventTypes.includes("PIPELINE_STAGE_ENTERED"));
  assert.equal(result.proposedPath.steps.length, 2);
});

test("emitSpecialtyBusinessEvent fans out only to ACTIVE matching subscribers", async () => {
  const calls = [];
  const installation = {
    configuration: {
      employees: [
        {
          employeeId: "emp_live",
          label: "Live bot",
          automationDefinitions: [{
            status: "ACTIVE",
            metadata: { employeeId: "emp_live", eventTypes: ["PIPELINE_STAGE_ENTERED"] },
          }],
          operatingContract: {
            trigger: { eventTypes: ["PIPELINE_STAGE_ENTERED"] },
            automationPath: { steps: [] },
          },
        },
        {
          employeeId: "emp_off",
          label: "Off bot",
          automationDefinitions: [{
            status: "INACTIVE",
            metadata: { employeeId: "emp_off", eventTypes: ["PIPELINE_STAGE_ENTERED"] },
          }],
          operatingContract: {
            trigger: { eventTypes: ["PIPELINE_STAGE_ENTERED"] },
          },
        },
        {
          employeeId: "emp_other",
          label: "Other events",
          automationDefinitions: [{
            status: "ACTIVE",
            metadata: { employeeId: "emp_other", eventTypes: ["SCHEDULE_CHANGE"] },
          }],
          operatingContract: {
            trigger: { eventTypes: ["SCHEDULE_CHANGE"] },
          },
        },
      ],
    },
  };

  const result = await emitSpecialtyBusinessEvent({
    installation,
    workRuntime: {},
    businessId: "biz_1",
    eventType: "PIPELINE_STAGE_ENTERED",
    brief: "Card moved",
    forceManual: false,
    fireFn: async (args) => {
      calls.push(args.employee.employeeId);
      const active = args.employee.automationDefinitions.some((a) => a.status === "ACTIVE");
      if (!active) return { ok: false, reason: "automation_inactive" };
      const events = args.employee.operatingContract.trigger.eventTypes;
      if (!events.includes(args.eventType) && !args.forceManual) {
        return { ok: false, reason: "event_not_subscribed" };
      }
      return { ok: true, workId: `work_${args.employee.employeeId}` };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["emp_live"]);
  assert.equal(result.firedCount, 1);
  assert.ok(result.skipped.some((s) => s.employeeId === "emp_other"));
});

test("executeSpecialtyPathSteps creates pipeline card for add_to_pipeline", async () => {
  let written = null;
  const crm0 = emptyCrmState();
  const pipeId = crm0.pipelines[0].id;
  const installation = {
    id: "inst_1",
    businessId: "biz_1",
    configuration: { crm: crm0 },
  };
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      written = row;
      return row;
    },
  };

  const employee = {
    employeeId: "emp_1",
    operatingContract: {
      automationPath: {
        customized: true,
        steps: [
          {
            id: "s1",
            type: PATH_STEP_TYPES.ADD_TO_PIPELINE,
            label: "Add lead",
            pipelineLabel: "Intake",
            enabled: true,
            order: 0,
          },
          {
            id: "s2",
            type: PATH_STEP_TYPES.SEND_EMAIL,
            label: "Email",
            requiresApproval: true,
            enabled: true,
            order: 1,
          },
        ],
      },
    },
  };

  // Rename default pipeline to Intake for label match
  installation.configuration.crm.pipelines[0].name = "Intake";

  const result = await executeSpecialtyPathSteps({
    employee,
    installation,
    platformStore,
    businessId: "biz_1",
    actorId: "tester",
    eventPayload: { title: "New opportunity from automation" },
    readinessSnapshot: {
      businessId: "biz_1",
      connections: [{ connectionType: "business_email", status: "CONNECTED" }],
      connectedTypes: ["business_email"],
      crmAvailable: true,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.executedCount, 1);
  assert.equal(result.deferredCount, 1);
  assert.ok(written?.configuration?.crm?.pipelines?.[0]?.cards?.length >= 1);
  assert.equal(
    written.configuration.crm.pipelines[0].cards.at(-1).title,
    "New opportunity from automation",
  );
  assert.equal(written.configuration.crm.pipelines[0].id, pipeId);
});

test("executeSpecialtyPathSteps resolves first pipeline when label missing", async () => {
  let written = null;
  const installation = {
    id: "inst_2",
    businessId: "biz_2",
    configuration: { crm: emptyCrmState() },
  };
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      written = row;
      return row;
    },
  };
  const result = await executeSpecialtyPathSteps({
    employee: {
      operatingContract: {
        automationPath: {
          steps: [{
            id: "p",
            type: "add_to_pipeline",
            pipelineLabel: "Does Not Exist",
            enabled: true,
            order: 0,
          }],
        },
      },
    },
    installation,
    platformStore,
    businessId: "biz_2",
    eventPayload: { title: "Fallback pipe card" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.executedCount, 1);
  assert.ok(written.configuration.crm.pipelines[0].cards.some((c) => c.title === "Fallback pipe card"));
});
