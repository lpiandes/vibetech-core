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

test("free-form text extracts structured answers and skips inferred questions", async () => {
  const engine = new BusinessDiscoveryEngine();
  const session = createBuilderSession({ currentStage: "interviewing" });
  const applied = await engine.applyFreeText(session, {
    text: "We are Bright Smile Dental in Austin. Patients book online. We use Dentrix and want less phone tag.",
  });
  assert.equal(applied.businessSummary.industry, "dental");
  assert.equal(applied.businessSummary.businessName, "Bright Smile Dental");
  assert.ok(applied.answers.some((entry) => entry.questionId === "q_tell_us"));
  assert.ok(applied.extracted.answeredQuestionIds.includes("q_company_name"));
  assert.ok(applied.extracted.answeredQuestionIds.includes("q_industry"));
});

test("question bank covers departments, lead sources, automation, and expansion", () => {
  const ids = DISCOVERY_QUESTION_BANK.map((q) => q.questionId);
  for (const id of ["q_departments", "q_lead_sources", "q_request_sources", "q_automation_comfort", "q_expansion_plans"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});
