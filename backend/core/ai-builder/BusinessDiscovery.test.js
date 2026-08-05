import assert from "node:assert/strict";
import { test } from "node:test";

import { BusinessDiscoveryEngine } from "./BusinessDiscoveryEngine.js";
import { BusinessDiscoveryQuestionPlanner, DISCOVERY_QUESTION_BANK } from "./BusinessDiscoveryQuestionPlanner.js";
import { BusinessDiscoveryAnswerInterpreter } from "./BusinessDiscoveryAnswerInterpreter.js";
import { createBuilderSession } from "./BuilderSession.js";

test("question planner starts with business understanding then responsibilities", () => {
  const planner = new BusinessDiscoveryQuestionPlanner();
  const first = planner.plan({ answers: [], evidence: [], limit: 5 });
  assert.ok(first[0].required);
  assert.equal(first[0].questionId, "q_business_understanding");

  const afterQ1 = planner.plan({
    answers: [{ questionId: "q_business_understanding", answer: "Hockey club" }],
    limit: 5,
  });
  assert.equal(afterQ1[0].questionId, "q_vibetech_responsibilities");

  // Pause until inventory confirmed
  const paused = planner.plan({
    answers: [
      { questionId: "q_business_understanding", answer: "Hockey club" },
      { questionId: "q_vibetech_responsibilities", answer: "Remind families about practices." },
    ],
    responsibilityRequests: [{ responsibilityId: "resp_1", status: "pending_review" }],
    responsibilityInventoryConfirmed: false,
    limit: 5,
  });
  assert.deepEqual(paused, []);

  const afterConfirm = planner.plan({
    answers: [
      { questionId: "q_business_understanding", answer: "Hockey club" },
      { questionId: "q_vibetech_responsibilities", answer: "Remind families." },
    ],
    evidence: [{ payload: { topics: ["software"] } }],
    responsibilityInventoryConfirmed: true,
    responsibilityRequests: [{
      responsibilityId: "resp_1",
      status: "confirmed",
      unresolvedFields: [],
      implementationMode: "ready_existing_capabilities",
    }],
    limit: 20,
  });
  // Lean path: no legacy topic-bank interview after responsibilities are clear.
  assert.deepEqual(afterConfirm, []);
});

test("answer interpreter maps industry signals without inventing certainty", () => {
  const interpreter = new BusinessDiscoveryAnswerInterpreter();
  const dental = interpreter.interpret({
    questionId: "q_business_understanding",
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
    questionId: "q_business_understanding",
    answer: "McBride-style property management with leasing and maintenance.",
  });
  assert.equal(applied.businessSummary.industry, "property_management");
  assert.ok(applied.nextQuestions.length >= 1);
  assert.equal(applied.nextQuestions[0].questionId, "q_vibetech_responsibilities");
  assert.ok(DISCOVERY_QUESTION_BANK.length >= 40);
  assert.match(engine.initialPrompt().text, /tell me about your business/i);
});

test("Q2 extracts responsibilities and pauses for review", async () => {
  const engine = new BusinessDiscoveryEngine();
  const session = createBuilderSession({
    currentStage: "interviewing",
    answers: [{ questionId: "q_business_understanding", answer: "Real estate brokerage in Tampa." }],
    businessSummary: { description: "Real estate brokerage in Tampa." },
  });
  const applied = await engine.applyAnswer(session, {
    questionId: "q_vibetech_responsibilities",
    answer: "Find active MLS listings and send a weekly newsletter. Follow up with missed calls. Remind people about appointments.",
  });
  assert.ok(applied.responsibilityRequests.length >= 3);
  assert.equal(applied.responsibilityInventoryConfirmed, false);
  assert.equal(applied.awaitingResponsibilityReview, true);
  assert.deepEqual(applied.nextQuestions, []);
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

test("package-ask is ready when focus questions are answered even without re-proving identity", async () => {
  const { BusinessDiscoveryCompleteness } = await import("./BusinessDiscoveryCompleteness.js");
  const completeness = new BusinessDiscoveryCompleteness();
  const progress = completeness.evaluate({
    answers: [
      { questionId: "q_communications", answer: "Phone and SMS" },
      { questionId: "q_integrations", answer: "twilio_voice" },
      { questionId: "q_desired_outcomes", answer: "Missed calls answered in 30 days" },
    ],
    businessSummary: {
      packageAsk: true,
      packageAskPackages: ["ai_receptionist", "social_background_screening"],
      purchasedPackages: ["ai_receptionist", "social_background_screening"],
    },
  });
  assert.equal(progress.requiredMissing.length, 0);
  assert.equal(progress.readyForProposal, true);
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

test("responsibility spine does not reopen pack diagnostics after clarify", () => {
  const planner = new BusinessDiscoveryQuestionPlanner();
  const spineDone = {
    answers: [
      { questionId: "q_business_understanding", answer: "Dental practice" },
      { questionId: "q_vibetech_responsibilities", answer: "Recall overdue patients." },
      { questionId: "q_industry", answer: "dental" },
    ],
    responsibilityInventoryConfirmed: true,
    responsibilityRequests: [{
      responsibilityId: "resp_x",
      status: "confirmed",
      unresolvedFields: [],
      implementationMode: "ready_existing_capabilities",
    }],
    limit: 20,
  };

  const dentalQuestions = planner.plan({
    ...spineDone,
    businessSummary: { industry: "dental" },
  });
  assert.deepEqual(dentalQuestions, []);

  const clarifying = planner.plan({
    ...spineDone,
    responsibilityRequests: [{
      responsibilityId: "resp_x",
      status: "confirmed",
      unresolvedFields: ["observe_where"],
      implementationMode: "ready_after_customer_access",
      title: "Recall",
    }],
  });
  assert.equal(clarifying.length, 1);
  assert.match(String(clarifying[0].questionId), /observe_where$/);
  assert.match(String(clarifying[0].prompt), /Where should VIBETech see/i);
});
