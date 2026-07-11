import assert from "node:assert/strict";
import { test } from "node:test";

import { BuilderSessionService } from "./BuilderSessionService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { DeterministicBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";
import { BusinessDiscoveryCompleteness } from "./BusinessDiscoveryCompleteness.js";
import { createBuilderSession } from "./BuilderSession.js";

const NOW = "2026-07-11T12:00:00.000Z";

test("durable builder session starts and answers without AI provider", async () => {
  const repository = new BuilderSessionRepository();
  const service = new BuilderSessionService({
    repository,
    intelligence: new DeterministicBuilderIntelligenceProvider(),
    nowISO: () => NOW,
  });

  const started = await service.startSession({
    mode: "new_business",
    businessName: null,
    description: "We run a youth travel hockey club with practices and scouting.",
  });
  assert.equal(started.ok, true);
  assert.equal(started.session.currentStage, "interviewing");
  assert.ok(started.session.conversation.length >= 2);
  assert.equal(started.session.businessSummary.industry, "sports");

  const answered = await service.answer({
    sessionId: started.session.sessionId,
    questionId: "q_company_name",
    answer: "Northline Travel Hockey",
  });
  assert.equal(answered.ok, true);
  assert.equal(answered.session.businessSummary.businessName, "Northline Travel Hockey");

  const reloaded = await service.getSession(started.session.sessionId);
  assert.equal(reloaded.businessSummary.businessName, "Northline Travel Hockey");
});

test("unknown answers stay unresolved and do not pretend certainty", async () => {
  const service = new BuilderSessionService({
    repository: new BuilderSessionRepository(),
    nowISO: () => NOW,
  });
  const started = await service.startSession({ mode: "client_self_service" });
  const unknown = await service.answer({
    sessionId: started.session.sessionId,
    questionId: "q_integrations",
    answer: "I don't know",
    unknown: true,
  });
  assert.ok(unknown.session.unresolvedQuestions.includes("q_integrations"));
  assert.ok(unknown.session.assumptions.some((entry) => entry.source === "unknown_answer"));
});

test("completeness requires identity and industry before proposal readiness", () => {
  const completeness = new BusinessDiscoveryCompleteness();
  const early = completeness.evaluate({
    answers: [],
    businessSummary: {},
  });
  assert.equal(early.readyForProposal, false);

  const session = createBuilderSession({
    businessSummary: { businessName: "Bright Smile Dental", industry: "dental" },
  });
  assert.equal(session.currentStage, "created");
});

test("session modes and stages are validated", () => {
  assert.throws(
    () => createBuilderSession({ mode: "not_a_mode" }),
    /unsupported mode/,
  );
  assert.throws(
    () => createBuilderSession({ currentStage: "teleporting" }),
    /unsupported stage/,
  );
});
