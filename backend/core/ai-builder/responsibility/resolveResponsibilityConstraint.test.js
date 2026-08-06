import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResponsibilityConstraintQuestion,
  resolveResponsibilityConstraintFromAsk,
} from "./resolveResponsibilityConstraint.js";

function fixture() {
  return {
    id: "install_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    specificationVersion: 1,
    specificationContentHash: "hash_1",
    planId: "plan_1",
    status: "installed",
    configuration: {
      responsibilityRequests: [{
        responsibilityId: "resp_1",
        title: "Appointment reminders",
        constraints: [{
          constraintId: "cstr_1",
          type: "BUSINESS_RULE_REQUIRED",
          status: "open",
          description: "Reminder timing is missing.",
        }],
      }],
      employees: [{
        employeeId: "emp_1",
        operatingContract: { responsibilityId: "resp_1" },
      }],
    },
    history: [],
  };
}

test("constraint question is grounded in the selected responsibility", () => {
  const installation = fixture();
  const request = installation.configuration.responsibilityRequests[0];
  const constraint = request.constraints[0];
  assert.match(buildResponsibilityConstraintQuestion({ request, constraint }), /Appointment reminders/);
  assert.match(buildResponsibilityConstraintQuestion({ request, constraint }), /exact rule/i);
});

test("Ask answer resolves constraint and records it on the operating contract", async () => {
  let saved = null;
  const store = {
    async upsertBusinessOSInstallation(row) { saved = row; return row; },
    async recordAuditEvent() {},
  };
  const result = await resolveResponsibilityConstraintFromAsk({
    platformStore: store,
    installation: fixture(),
    responsibilityId: "resp_1",
    constraintId: "cstr_1",
    answer: "Send reminders 24 hours before the appointment and require approval for any reschedule.",
    actorId: "user_1",
    sessionId: "sess_1",
    nowISO: "2026-08-06T15:00:00.000Z",
  });

  assert.equal(result.ok, true);
  const request = saved.configuration.responsibilityRequests[0];
  assert.equal(request.constraints[0].status, "resolved");
  assert.equal(request.status, "live");
  assert.match(request.constraints[0].proofReference, /^ask:sess_1:/);
  assert.equal(saved.configuration.employees[0].operatingContract.confirmedRules.length, 1);
  assert.equal(saved.history.at(-1).event, "responsibility_constraint_resolved");
});

test("consent Ask answer stores structured consent policy", async () => {
  let saved = null;
  const installation = fixture();
  installation.configuration.responsibilityRequests[0].constraints[0] = {
    constraintId: "cstr_consent",
    type: "CONSENT_POLICY_REQUIRED",
    status: "open",
    owner: "Customer",
    description: "Who may be contacted is missing.",
  };
  const result = await resolveResponsibilityConstraintFromAsk({
    platformStore: {
      async upsertBusinessOSInstallation(row) { saved = row; return row; },
      async recordAuditEvent() {},
    },
    installation,
    responsibilityId: "resp_1",
    constraintId: "cstr_consent",
    answer: "Only opted-in customers and never cold purchased lists.",
    actorId: "user_1",
    sessionId: "sess_2",
  });
  assert.equal(result.ok, true);
  const request = saved.configuration.responsibilityRequests[0];
  assert.equal(request.constraints[0].status, "resolved");
  assert.match(String(request.consentPolicy?.text ?? ""), /opted-in/);
  assert.equal(request.status, "live");
});

test("vague Ask answer leaves constraint open", async () => {
  const result = await resolveResponsibilityConstraintFromAsk({
    platformStore: { async upsertBusinessOSInstallation() { throw new Error("should not persist"); } },
    installation: fixture(),
    responsibilityId: "resp_1",
    constraintId: "cstr_1",
    answer: "I don't know",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "specific_answer_required");
});
