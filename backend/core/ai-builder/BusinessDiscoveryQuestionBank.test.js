import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DISCOVERY_QUESTION_BANK,
  estimateDiscoveryQuestionCount,
} from "./BusinessDiscoveryQuestionPlanner.js";
import { BusinessDiscoveryCompleteness } from "./BusinessDiscoveryCompleteness.js";
import { deriveRequiredSetupSteps } from "./requiredSetupSteps.js";
import {
  buildPlatformSetupChecklist,
  deriveRequiredSetupStepsFromIntegrations,
} from "../operating-home/buildPlatformSetupChecklist.js";

test("question bank snapshot lists every question with required and industry gating", () => {
  const snapshot = DISCOVERY_QUESTION_BANK.map((question) => ({
    questionId: question.questionId,
    required: question.required,
    whenIndustry: question.whenIndustry ?? null,
    topic: question.topic,
    answerType: question.answerType ?? "text",
  }));

  assert.ok(snapshot.length >= 40, "expected expanded discovery bank");
  assert.ok(snapshot.some((entry) => entry.questionId === "q_value_promise"));
  assert.ok(snapshot.some((entry) => entry.questionId === "q_bottlenecks"));
  assert.ok(snapshot.some((entry) => entry.questionId === "q_campaign_race_type"));
  assert.ok(snapshot.some((entry) => entry.questionId === "q_dental_pms"));
  assert.ok(snapshot.some((entry) => entry.questionId === "q_proservices_engagement"));
  assert.deepEqual(
    snapshot.find((entry) => entry.questionId === "q_industry")?.whenIndustry,
    null,
  );

  const universalRequired = snapshot.filter((entry) => entry.required && !entry.whenIndustry);
  assert.ok(universalRequired.length >= 16);
});

test("completeness requires full required core before propose", () => {
  const completeness = new BusinessDiscoveryCompleteness();
  const partial = completeness.evaluate({
    answers: [
      { questionId: "q_tell_us", answer: "Dental practice" },
      { questionId: "q_company_name", answer: "Bright Smile Dental" },
      { questionId: "q_website", answer: "https://example.com" },
      { questionId: "q_industry", answer: "dental" },
    ],
    businessSummary: {
      businessName: "Bright Smile Dental",
      industry: "dental",
      description: "Dental practice",
    },
  });
  assert.equal(partial.readyForProposal, false);
  assert.ok(partial.requiredMissing.length > 0);
});

test("required setup steps include a2p when sms is selected", () => {
  assert.deepEqual(
    deriveRequiredSetupSteps(["business_email", "sms_channel"]),
    ["email", "sms", "a2p_registration"],
  );
  assert.deepEqual(
    deriveRequiredSetupStepsFromIntegrations([
      { integrationId: "business_email", status: "required" },
      { integrationId: "sms_channel", status: "required" },
    ]),
    ["email", "sms", "a2p_registration"],
  );
});

test("platform setup checklist marks a2p incomplete until owner confirms", () => {
  const checklist = buildPlatformSetupChecklist({
    workspaceId: "biz_test",
    requiredSetupSteps: ["email", "sms", "a2p_registration"],
    connections: [
      { id: "business_email", status: "CONNECTED" },
      { id: "sms_channel", status: "CONNECTED" },
    ],
    connectionRuntime: {
      getConnectionByType(type) {
        if (type === "sms_channel") {
          return { metadata: { a2pRegistrationStatus: "pending" } };
        }
        return null;
      },
    },
    teamInviteChecklistComplete: true,
    knowledgeCount: 2,
  });

  const a2p = checklist.find((entry) => entry.id === "a2p_registration");
  assert.ok(a2p);
  assert.equal(a2p.complete, false);

  const completeChecklist = buildPlatformSetupChecklist({
    workspaceId: "biz_test",
    requiredSetupSteps: ["email", "sms", "a2p_registration"],
    connections: [
      { id: "business_email", status: "CONNECTED" },
      { id: "sms_channel", status: "CONNECTED" },
    ],
    connectionRuntime: {
      getConnectionByType(type) {
        if (type === "sms_channel") {
          return { metadata: { a2pRegistrationStatus: "complete" } };
        }
        return null;
      },
    },
    teamInviteChecklistComplete: true,
    knowledgeCount: 2,
  });
  assert.equal(completeChecklist.find((entry) => entry.id === "a2p_registration")?.complete, true);
});

test("estimated discovery depth grows with industry pack", () => {
  const dental = estimateDiscoveryQuestionCount({ industry: "dental" });
  const other = estimateDiscoveryQuestionCount({ industry: "other" });
  assert.ok(dental.estimatedTotal > dental.coreRequired);
  assert.ok(other.packRequired >= 3);
});
