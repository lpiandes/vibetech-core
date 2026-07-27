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
    evidence: [{ payload: { topics: ["software"] } }],
    limit: 20,
  });
  assert.ok(withEvidence.some((question) => question.questionId === "q_communications"));
  // Software is required — always ask even if website research already hinted at tools.
  assert.ok(withEvidence.some((question) => question.questionId === "q_software"));
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

  const junkName = interpreter.interpret({
    questionId: "q_company_name",
    answer: "ok",
  });
  assert.equal(junkName.unknown, true);
  assert.equal(junkName.fields.businessName, undefined);
  assert.ok(junkName.unresolved.includes("q_company_name"));

  const junkIndustry = interpreter.interpret({
    questionId: "q_industry",
    answer: "ok",
  });
  assert.equal(junkIndustry.fields.industry, "other");
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
  assert.ok(DISCOVERY_QUESTION_BANK.length >= 40);
  assert.match(engine.initialPrompt().text, /describe your business/i);
});

test("ready discovery does not queue a question behind recommendation", async () => {
  const engine = new BusinessDiscoveryEngine({
    planner: {
      plan() {
        throw new Error("planner must not run after discovery is ready");
      },
    },
    completeness: {
      evaluate() {
        return {
          readyForProposal: true,
          percent: 100,
          requiredTotal: 12,
          requiredAnswered: 12,
          requiredMissing: [],
          unresolvedCount: 0,
        };
      },
    },
  });
  const session = createBuilderSession({
    currentStage: "interviewing",
    businessSummary: {
      businessName: "Whalers Hockey Club",
      industry: "sports",
      purchasedPackages: ["ai_receptionist", "crm_automation"],
    },
  });

  const applied = await engine.applyAnswer(session, {
    questionId: "q_desired_outcomes",
    answer: "Answer every call and capture every family inquiry.",
  });

  assert.equal(applied.progress.readyForProposal, true);
  assert.deepEqual(applied.nextQuestions, []);
});

test("integrations answer maps to connection ids the owner must sign into", () => {
  const interpreter = new BusinessDiscoveryAnswerInterpreter();
  const result = interpreter.interpret({
    questionId: "q_integrations",
    answer: "gmail, google_calendar, twilio_sms, facebook_lead_ads",
  });
  assert.deepEqual([...result.fields.integrationNeeds].sort(), [
    "business_email",
    "calendar",
    "meta_lead_ads",
    "sms_channel",
  ].sort());
  assert.deepEqual(result.fields.requiredSetupSteps, ["email", "calendar", "sms", "a2p_registration", "meta_lead_ads"]);
  assert.equal(result.fields.ownerWillConnectAccounts, true);
  assert.match(result.fields.connectionSetupNote, /sign into/i);

  const none = interpreter.interpret({
    questionId: "q_integrations",
    answer: "none yet",
  });
  assert.deepEqual(none.fields.integrationNeeds, []);
  assert.equal(none.fields.ownerWillConnectAccounts, false);
});

test("growth-channel selections are recorded without claiming they are connected", () => {
  const interpreter = new BusinessDiscoveryAnswerInterpreter();
  const result = interpreter.interpret({
    questionId: "q_integrations",
    answer: "google_ads, google_search_console, meta_ads",
  });
  assert.deepEqual([...result.fields.integrationNeeds].sort(), [
    "google_ads",
    "google_search_console",
    "meta_ads",
  ]);
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
  for (const id of ["q_departments", "q_lead_sources", "q_request_sources", "q_automation_comfort", "q_expansion_plans", "q_value_promise", "q_bottlenecks"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});

test("only active operating packs receive curated diagnostic questions", () => {
  const planner = new BusinessDiscoveryQuestionPlanner();
  const unsupportedIndustryQuestions = planner.plan({
    answers: [
      { questionId: "q_industry", answer: "political_campaigns" },
    ],
    businessSummary: { industry: "political_campaigns" },
    limit: 20,
  });
  assert.ok(!unsupportedIndustryQuestions.some((question) => question.questionId === "q_campaign_race_type"));
  assert.ok(!unsupportedIndustryQuestions.some((question) => question.questionId === "q_dental_pms"));

  const dentalQuestions = planner.plan({
    answers: [{ questionId: "q_industry", answer: "dental" }],
    businessSummary: { industry: "dental" },
    limit: 20,
  });
  assert.ok(dentalQuestions.some((question) => question.questionId === "q_dental_pms"));
});
