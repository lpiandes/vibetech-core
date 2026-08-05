import test from "node:test";
import assert from "node:assert/strict";

import { extractResponsibilityRequests } from "./extractResponsibilityRequests.js";
import { assessResponsibilityInventory } from "./resolveResponsibilityFeasibility.js";
import { compileResponsibilityOperatingContract } from "./compileResponsibilityOperatingContract.js";
import { planNextResponsibilityQuestions } from "./planResponsibilityQuestions.js";

test("five requests in one paragraph produce five reviewable candidates", () => {
  const text = [
    "Find active MLS listings and send a weekly newsletter.",
    "Follow up with missed calls.",
    "Remind people about appointments.",
    "Contact old clients twice a year.",
    "When a lead submits our form, qualify it and schedule a call.",
  ].join(" ");

  const { requests, count } = extractResponsibilityRequests({ text, businessId: "biz_test" });
  assert.equal(count, 5);
  assert.equal(requests.length, 5);
  for (const req of requests) {
    assert.ok(req.responsibilityId);
    assert.ok(req.title);
    assert.ok(req.rawRequest);
    assert.equal(req.status, "pending_review");
  }
});

test("feasibility marks personal phone monitoring unsupported", () => {
  const { requests } = extractResponsibilityRequests({
    text: "Silently monitor the missed-call history on every employee’s personal iPhone.",
  });
  const [assessed] = assessResponsibilityInventory(requests);
  assert.equal(assessed.implementationMode, "unsupported_or_unsafe");
  assert.ok(assessed.constraints.some((c) => c.type === "UNSUPPORTED_TRIGGER"));
});

test("clarification planner returns unresolved field questions after confirm", () => {
  const { requests } = extractResponsibilityRequests({
    text: "Follow up with proposals that have had no reply for five business days.",
  });
  const confirmed = requests.map((r) => ({ ...r, status: "confirmed" }));
  const questions = planNextResponsibilityQuestions({
    responsibilityRequests: confirmed,
    answers: [],
    limit: 3,
  });
  assert.ok(questions.length >= 1);
  assert.match(String(questions[0].questionId), /^q_resp_/);
});

test("compileResponsibilityOperatingContract builds a dedicated contract", () => {
  const { requests } = extractResponsibilityRequests({
    text: "Remind people about appointments before they happen.",
  });
  const [assessed] = assessResponsibilityInventory(requests);
  const compiled = compileResponsibilityOperatingContract({
    request: { ...assessed.request, status: "confirmed" },
    industry: "other",
  });
  assert.equal(compiled.responsibilityId, assessed.request.responsibilityId);
  assert.ok(compiled.contract);
  assert.ok(compiled.employee?.operatingContract?.automationPath?.steps?.length >= 3);
});
