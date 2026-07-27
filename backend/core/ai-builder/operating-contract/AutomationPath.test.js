import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultAutomationPath,
  normalizeAutomationPath,
  normalizePathStep,
  presentAutomationPath,
  PATH_STEP_TYPES,
} from "./automationPath.js";
import { applyOperatingContractPatch, buildOperatingContract, presentOperatingContract } from "./buildOperatingContract.js";

const NOW = "2026-07-20T16:00:00.000Z";

test("buildDefaultAutomationPath seeds draft + email + sms from channels", () => {
  const contract = {
    schemaId: "sports_family_comms",
    scope: {
      answers: {
        audience: { value: "U12 families" },
        where: { value: "Email and SMS" },
        when: { value: "Sundays" },
      },
    },
  };
  const path = buildDefaultAutomationPath({ contract });
  assert.ok(path.steps.length >= 3);
  assert.equal(path.steps[0].type, PATH_STEP_TYPES.CREATE_DRAFT);
  assert.ok(path.steps.some((s) => s.type === PATH_STEP_TYPES.SEND_EMAIL));
  assert.ok(path.steps.some((s) => s.type === PATH_STEP_TYPES.SEND_SMS));
});

test("presentAutomationPath uses simple action titles with detail summaries", () => {
  const path = buildDefaultAutomationPath({
    contract: {
      scope: {
        answers: {
          where: { value: "Email and SMS" },
          when: { value: "Sundays" },
        },
      },
    },
  });
  const presented = presentAutomationPath({
    contract: { automationPath: path, trigger: { mode: "manual_or_events", summary: "Schedule changes" } },
  });
  const draft = presented.steps.find((s) => s.type === PATH_STEP_TYPES.CREATE_DRAFT);
  const email = presented.steps.find((s) => s.type === PATH_STEP_TYPES.SEND_EMAIL);
  assert.equal(draft.displayTitle, "Create draft");
  assert.match(draft.displaySummary, /Manual|Needs you|review/i);
  assert.equal(email.displayTitle, "Send email");
  assert.match(email.displaySummary, /Manual|Needs you/i);
  assert.equal(email.runMode, "manual");
  assert.equal(presented.trigger.label.includes("Manual") || presented.trigger.kind === "trigger", true);
});

test("normalizePathStep persists runMode manual vs auto", () => {
  const manual = normalizePathStep({ type: "send_email", runMode: "manual" }, 0);
  const auto = normalizePathStep({ type: "send_email", runMode: "auto" }, 1);
  const draftAuto = normalizePathStep({ type: "create_draft", runMode: "auto" }, 2);
  assert.equal(manual.runMode, "manual");
  assert.equal(manual.requiresApproval, true);
  assert.equal(auto.runMode, "auto");
  assert.equal(auto.requiresApproval, false);
  assert.equal(draftAuto.runMode, "auto");
  assert.equal(draftAuto.requiresApproval, false);
});

test("PATCH automationPath persists customized multi-email path", () => {
  const built = buildOperatingContract({
    employee: { employeeId: "emp_1", label: "Comms" },
    industry: "sports",
  });
  const next = applyOperatingContractPatch({
    employee: { employeeId: "emp_1", operatingContract: built.contract },
    industry: "sports",
    patch: {
      automationPath: {
        version: 1,
        steps: [
          { id: "a", type: "create_draft", label: "Draft", order: 0 },
          {
            id: "b",
            type: "send_email",
            label: "Email team",
            audience: "team",
            subject: "New lead",
            body: "Please follow up",
            order: 1,
          },
          {
            id: "c",
            type: "send_email",
            label: "Email submitter",
            audience: "submitter",
            subject: "Thanks",
            body: "We got your form",
            order: 2,
          },
          {
            id: "d",
            type: "send_sms",
            label: "SMS team",
            audience: "team",
            body: "New lead in",
            order: 3,
          },
          {
            id: "e",
            type: "add_to_pipeline",
            label: "Pipeline",
            pipelineLabel: "New leads",
            order: 4,
          },
        ],
      },
    },
    nowISO: NOW,
  });
  assert.equal(next.contract.automationPath.customized, true);
  assert.equal(next.contract.automationPath.steps.length, 5);
  assert.equal(
    next.contract.automationPath.steps.filter((s) => s.type === "send_email").length,
    2,
  );
  const presentation = presentOperatingContract(next.contract, next.schema);
  assert.ok(presentation.automationPath.steps.length >= 5);
});

test("normalizeAutomationPath keeps owner order", () => {
  const path = normalizeAutomationPath({
    steps: [
      { id: "2", type: "send_sms", order: 1, body: "hi" },
      { id: "1", type: "send_email", order: 0, subject: "sub" },
    ],
  });
  assert.equal(path.steps[0].id, "1");
  assert.equal(path.steps[1].id, "2");
});
