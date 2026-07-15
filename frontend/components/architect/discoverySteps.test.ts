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
