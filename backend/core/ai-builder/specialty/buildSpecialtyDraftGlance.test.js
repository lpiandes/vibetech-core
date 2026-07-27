import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSpecialtyDraftGlance } from "./buildSpecialtyDraftGlance.js";

test("glance uses lead name + trigger for a Meta-style draft", () => {
  const glance = buildSpecialtyDraftGlance({
    employee: { label: "Intake specialist" },
    triggerLabel: "Meta / Facebook lead",
    eventPayload: { name: "John Doe", email: "j@x.com" },
    artifact: { title: "Intake follow-up" },
    approvalIds: ["apr_1"],
    businessId: "biz_1",
    workId: "work_1",
  });
  assert.match(glance.title, /Intake specialist/);
  assert.match(glance.title, /John Doe/);
  assert.match(glance.summary, /Meta \/ Facebook lead/);
  assert.match(glance.whyNeedsYou, /Approve/);
  assert.match(glance.workHref, /workId=work_1/);
});

test("glance stays generic without lead fields", () => {
  const glance = buildSpecialtyDraftGlance({
    employee: { name: "Coach helper" },
    triggerEventType: "SPECIALTY_JOB_REQUESTED",
    brief: "Prepare this week's practice plan",
    artifact: { title: "Practice plan" },
    approvalIds: [],
  });
  assert.match(glance.title, /Coach helper prepared a draft/);
  assert.match(glance.summary, /Practice plan|SPECIALTY|practice/i);
  assert.match(glance.whyNeedsYou, /Open the draft|decide/i);
});
