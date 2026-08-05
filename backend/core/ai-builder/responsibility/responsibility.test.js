import test from "node:test";
import assert from "node:assert/strict";

import { extractResponsibilityRequests, pruneUnresolvedForLeanClarify } from "./extractResponsibilityRequests.js";
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

test("lean extract skips interview fields when Q2 already said enough", () => {
  const { requests } = extractResponsibilityRequests({
    text: [
      "• When a new inbound lead arrives, confirm contact details and log it in Work as New inbound within 15 minutes.",
      "• Same business day: call first if there is a phone number; if no answer, send the approved SMS/email draft.",
      "• If no reply in 24 hours, send one polite follow-up.",
    ].join("\n"),
  });
  assert.equal(requests.length, 3);
  const unresolvedTotal = requests.reduce((n, r) => n + (r.unresolvedFields?.length ?? 0), 0);
  assert.ok(unresolvedTotal <= 3, `expected lean unresolved, got ${unresolvedTotal}`);
  for (const req of requests) {
    assert.ok(req.triggerDescription || req.unresolvedFields.includes("trigger"));
    assert.ok(req.approvalExpectations);
    assert.ok(req.failureBehavior);
  }

  const pruned = pruneUnresolvedForLeanClarify(
    requests.map((r) => ({ ...r, status: "confirmed" })),
    { maxQuestions: 3 },
  );
  const after = pruned.reduce((n, r) => n + (r.unresolvedFields?.length ?? 0), 0);
  assert.ok(after <= 3);

  const questions = planNextResponsibilityQuestions({
    responsibilityRequests: pruned,
    answers: [],
    limit: 8,
  });
  assert.ok(questions.length <= 3);
});

test("clarification planner returns unresolved field questions after confirm", () => {
  const { requests } = extractResponsibilityRequests({
    text: "Do the thing with no clear trigger wording at all for this oddball case xyz.",
  });
  // Force an unresolved observe_where for the planner smoke test.
  const confirmed = requests.map((r) => ({
    ...r,
    status: "confirmed",
    unresolvedFields: ["observe_where"],
  }));
  const questions = planNextResponsibilityQuestions({
    responsibilityRequests: confirmed,
    answers: [],
    limit: 3,
  });
  assert.ok(questions.length >= 1);
  assert.match(String(questions[0].questionId), /^q_resp_/);
  assert.match(String(questions[0].prompt), /Where should VIBETech see/i);
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
