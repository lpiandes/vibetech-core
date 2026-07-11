import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessDiscoveryEngine } from "./BusinessDiscoveryEngine.js";
import { BusinessDiscoveryQuestionPlanner, DISCOVERY_QUESTION_BANK } from "./BusinessDiscoveryQuestionPlanner.js";
import { BusinessDiscoveryAnswerInterpreter } from "./BusinessDiscoveryAnswerInterpreter.js";
import { createBuilderSession } from "./BuilderSession.js";

test("question planner asks required topics first and skips known optional topics", () => {
  const planner = new BusinessDiscoveryQuestionPlanner();
  const first = planner.plan({ answers: [], evidence: [], limit: 5 });
  assert.ok(first[0].required);
  assert.ok(first.some((question) => question.questionId === "q_tell_us"));

  const withEvidence = planner.plan({
    answers: [{ questionId: "q_tell_us", answer: "Hockey club" }],
    evidence: [{ payload: { topics: ["communications"] } }],
    limit: 20,
  });
  assert.ok(!withEvidence.some((question) => question.questionId === "q_communications"));
});

test("answer interpreter maps industry signals without inventing certainty", () => {
  const interpreter = new BusinessDiscoveryAnswerInterpreter();
  const dental = interpreter.interpret({
    questionId: "q_tell_us",
    answer: "Bright Smile Dental serves families with cleanings and treatment plans.",
  });
  assert.equal(dental.fields.industry, "dental");
  assert.ok(dental.fields.customerTypes.includes("patient"));

  const unknown = interpreter.interpret({
    questionId: "q_software",
    answer: "I don't know",
    unknown: true,
  });
  assert.equal(unknown.unknown, true);
  assert.deepEqual(unknown.fields, {});
});

test("discovery engine progresses conversationally", async () => {
  const engine = new BusinessDiscoveryEngine();
  let session = createBuilderSession({ currentStage: "discovering" });
  const applied = await engine.applyAnswer(session, {
    questionId: "q_tell_us",
    answer: "McBride-style property management with leasing and maintenance.",
  });
  assert.equal(applied.businessSummary.industry, "property_management");
  assert.ok(applied.nextQuestions.length >= 1);
  assert.ok(DISCOVERY_QUESTION_BANK.length >= 15);
  assert.match(engine.initialPrompt().text, /Tell us about your business/);
});
