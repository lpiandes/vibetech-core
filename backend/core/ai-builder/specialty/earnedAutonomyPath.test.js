import assert from "node:assert/strict";
import { test } from "node:test";

import { executeSpecialtyPathSteps } from "./executeSpecialtyPathSteps.js";

test("Plan 22: external auto skips owner grant when class is auto-eligible", async () => {
  const installation = {
    businessId: "biz_1",
    configuration: {
      rftAutonomy: {
        version: 1,
        updatedAt: new Date().toISOString(),
        classes: {
          existing_customer_scheduling: {
            classId: "existing_customer_scheduling",
            delegatedAt: "2026-08-01T00:00:00.000Z",
            delegatedBy: "owner",
            revokedAt: null,
            lastStatus: "auto_eligible",
            earnedAtPolicyHash: "hash_1",
          },
        },
      },
      rftLaunch: { goLiveAt: "2026-08-01T00:00:00.000Z" },
    },
  };

  const result = await executeSpecialtyPathSteps({
    employee: {
      employeeId: "emp_1",
      operatingContract: {
        automationPath: {
          steps: [{
            id: "step_1",
            type: "send_email",
            runMode: "auto",
            enabled: true,
            direction: "external",
            audience: "scope_who",
            label: "Schedule follow-up meeting",
            subject: "Schedule",
            body: "Let's book time.",
          }],
        },
      },
    },
    installation,
    businessId: "biz_1",
    eventPayload: {
      kind: "meeting",
      title: "Schedule follow-up",
      email: "a@b.com",
      evidence: [{ providerId: "cal_1" }],
    },
    workItemId: "work_1",
    workItem: {
      id: "work_1",
      title: "Schedule follow-up",
      metadata: { eventPayload: { email: "a@b.com", name: "Alex" } },
    },
    readinessSnapshot: {
      businessId: "biz_1",
      connections: [{ id: "business_email", status: "CONNECTED" }],
      connectedTypes: ["business_email"],
      crmAvailable: true,
    },
    integrationHub: {
      async executeAction() {
        return { ok: true, providerId: "msg_auto_1", messageId: "msg_auto_1" };
      },
    },
    executionMode: "live",
  });

  const sendNote = result.notes.find((n) => n.stepId === "step_1");
  assert.ok(sendNote);
  assert.equal(sendNote.needsYou, false);
  assert.equal(sendNote.reason, "auto_sent_earned_autonomy");
  assert.equal(sendNote.classAutoEligible, true);
});

test("Plan 22: external auto still needs grant when class is not eligible", async () => {
  const events = [];
  const approvalRuntime = {
    getRequestById() { return null; },
    applyEvent(evt) { events.push(evt); },
  };

  const result = await executeSpecialtyPathSteps({
    employee: {
      employeeId: "emp_1",
      operatingContract: {
        automationPath: {
          steps: [{
            id: "step_1",
            type: "send_email",
            runMode: "auto",
            enabled: true,
            direction: "external",
            audience: "scope_who",
            label: "New lead acknowledgement",
            subject: "Thanks",
            body: "Hello",
          }],
        },
      },
    },
    installation: { businessId: "biz_1", configuration: { rftAutonomy: { classes: {} } } },
    businessId: "biz_1",
    eventPayload: { email: "lead@example.com", title: "New website inquiry" },
    workItemId: "work_2",
    approvalRuntime,
    readinessSnapshot: {
      businessId: "biz_1",
      connections: [{ id: "business_email", status: "CONNECTED" }],
      connectedTypes: ["business_email"],
      crmAvailable: true,
    },
    executionMode: "live",
  });

  const note = result.notes.find((n) => n.stepId === "step_1");
  assert.ok(note);
  assert.equal(note.needsYou, true);
  assert.equal(note.reason, "awaiting_owner_grant");
  assert.ok(events.length >= 1);
});
