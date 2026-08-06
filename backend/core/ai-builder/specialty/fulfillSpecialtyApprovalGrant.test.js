import assert from "node:assert/strict";
import { test } from "node:test";

import { fulfillSpecialtyApprovalGrant } from "./fulfillSpecialtyApprovalGrant.js";

test("fulfillSpecialtyApprovalGrant skips non-specialty approvals", async () => {
  const result = await fulfillSpecialtyApprovalGrant({
    approvalRequest: {
      source: "automation",
      sourceReference: { runId: "run_1", actionId: "act_1" },
    },
    businessId: "biz_1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
});

test("fulfillSpecialtyApprovalGrant fails visibly without workItemId", async () => {
  const result = await fulfillSpecialtyApprovalGrant({
    approvalRequest: {
      source: "specialty_automation",
      sourceReference: { employeeId: "emp_1", businessId: "biz_1" },
      metadata: { specialtyPath: true },
    },
    businessId: "biz_1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_work_or_business");
});

test("fulfillSpecialtyApprovalGrant sends via path and returns proof on success", async () => {
  const workItem = {
    id: "work_1",
    title: "Follow up",
    metadata: {
      rftCardId: "card_1",
      eventPayload: { email: "lead@example.com", name: "Lead" },
    },
  };
  const installation = {
    businessId: "biz_1",
    configuration: {
      employees: [{
        employeeId: "emp_1",
        operatingContract: {
          automationPath: {
            steps: [{
              id: "step_email",
              type: "send_email",
              enabled: true,
              direction: "external",
              audience: "scope_who",
              subject: "Hello",
              body: "Thanks for reaching out.",
            }],
          },
        },
      }],
      crm: {
        version: 1,
        stages: [{
          id: "open",
          cards: [{
            id: "card_1",
            title: "Lead",
            rft: { state: "ApprovalRequired", evidence: [] },
          }],
        }],
      },
    },
  };

  const writes = [];
  const platformStore = {
    async getBusinessOSInstallation() {
      return installation;
    },
    async upsertBusinessOSInstallation(row) {
      writes.push(row);
      return row;
    },
  };

  // Patch writeCrmState path: progressRftOpportunity uses writeCrmState → upsert
  // Ensure CRM write path works by providing upsert on store used by CrmStore.
  const result = await fulfillSpecialtyApprovalGrant({
    approvalRequest: {
      source: "specialty_automation",
      sourceReference: {
        workItemId: "work_1",
        employeeId: "emp_1",
        businessId: "biz_1",
        stepId: "step_email",
      },
      context: { channel: "email", subject: "Hello", bodyPreview: "Thanks" },
      metadata: { specialtyPath: true },
    },
    businessId: "biz_1",
    platformStore,
    installation,
    workRuntime: {
      getWorkItem: (id) => (id === "work_1" ? workItem : null),
    },
    integrationHub: {
      async executeAction() {
        return { ok: true, providerId: "msg_test_123", messageId: "msg_test_123" };
      },
    },
    actorId: "owner_1",
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.send?.ok, true);
  assert.ok(Array.isArray(result.evidence));
  assert.ok(result.evidence.length >= 1);
});
