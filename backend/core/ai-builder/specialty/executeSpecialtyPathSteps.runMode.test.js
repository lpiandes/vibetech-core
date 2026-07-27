import assert from "node:assert/strict";
import { test } from "node:test";

import { executeSpecialtyPathSteps } from "./executeSpecialtyPathSteps.js";
import { PATH_STEP_TYPES } from "../operating-contract/automationPath.js";

test("manual create_draft notes needsYou; auto does not", async () => {
  const manual = await executeSpecialtyPathSteps({
    employee: {
      operatingContract: {
        automationPath: {
          version: 1,
          steps: [
            { id: "d1", type: PATH_STEP_TYPES.CREATE_DRAFT, label: "Draft", enabled: true, runMode: "manual", order: 0 },
          ],
        },
      },
    },
  });
  assert.equal(manual.needsYou, true);
  assert.equal(manual.notes[0].needsYou, true);

  const auto = await executeSpecialtyPathSteps({
    employee: {
      operatingContract: {
        automationPath: {
          version: 1,
          steps: [
            { id: "d2", type: PATH_STEP_TYPES.CREATE_DRAFT, label: "Draft", enabled: true, runMode: "auto", order: 0 },
          ],
        },
      },
    },
  });
  assert.equal(auto.needsYou, false);
  assert.equal(auto.notes[0].needsYou, false);
});

test("auto outbound sends without approval when recipients exist", async () => {
  let sent = null;
  const result = await executeSpecialtyPathSteps({
    employee: {
      operatingContract: {
        automationPath: {
          version: 1,
          steps: [
            {
              id: "e1",
              type: PATH_STEP_TYPES.SEND_EMAIL,
              label: "Email",
              enabled: true,
              runMode: "auto",
              requiresApproval: false,
              direction: "external",
              audience: "submitter",
              subject: "Hi [Name]",
              body: "Welcome",
              order: 0,
            },
          ],
        },
      },
    },
    eventPayload: { name: "Alex", email: "alex@example.com" },
    sendEmail: async (payload) => {
      sent = payload;
      return { ok: true };
    },
  });
  assert.equal(result.needsYou, false);
  assert.equal(result.notes[0].reason, "auto_sent");
  assert.equal(sent?.to, "alex@example.com");
});

test("manual outbound creates approval and needsYou", async () => {
  const events = [];
  const result = await executeSpecialtyPathSteps({
    employee: {
      employeeId: "emp_1",
      operatingContract: {
        automationPath: {
          version: 1,
          steps: [
            {
              id: "e2",
              type: PATH_STEP_TYPES.SEND_EMAIL,
              label: "Email",
              enabled: true,
              runMode: "manual",
              direction: "external",
              audience: "submitter",
              subject: "Hi",
              body: "Body",
              order: 0,
            },
          ],
        },
      },
    },
    workItemId: "work_1",
    eventPayload: { email: "alex@example.com" },
    approvalRuntime: {
      getRequestById: () => null,
      applyEvent: (evt) => { events.push(evt); },
    },
  });
  assert.equal(result.needsYou, true);
  assert.equal(result.notes[0].reason, "awaiting_owner_grant");
  assert.ok(result.notes[0].approvalId);
  assert.equal(events.length, 1);
});
