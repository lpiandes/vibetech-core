import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDiscoverySteps } from "./discoverySteps.ts";

test("buildDiscoverySteps shows answered questions then the current one", () => {
  const steps = buildDiscoverySteps(
    [
      { questionId: "q_tell_us", answer: "Home health care" },
      { questionId: "q_company_name", answer: "Mind and Mobility" },
    ],
    { questionId: "q_website", prompt: "Do you have a website we can review?" },
  );

  assert.equal(steps.length, 3);
  assert.equal(steps[0].questionId, "q_tell_us");
  assert.equal(steps[0].isCurrent, false);
  assert.equal(steps[0].answer, "Home health care");
  assert.equal(steps[2].questionId, "q_website");
  assert.equal(steps[2].isCurrent, true);
  assert.equal(steps[2].answer, "");
});

test("package-ask completion must not rebuild answered integrations from the generic bank as current", () => {
  // When nextQuestion is null, the wizard treats discovery as complete and must
  // not present the last answered step (which rebuilds from DISCOVERY_QUESTION_BANK).
  const steps = buildDiscoverySteps(
    [{ questionId: "q_integrations", answer: "google_calendar" }],
    null,
  );
  assert.equal(steps.length, 1);
  assert.equal(steps[0].isCurrent, false);
  // Generic bank prompt — proving why the wizard must ignore this when complete.
  assert.match(String(steps[0].prompt), /Which accounts will you connect/i);
  assert.ok((steps[0].options ?? []).includes("gmail"));
});
