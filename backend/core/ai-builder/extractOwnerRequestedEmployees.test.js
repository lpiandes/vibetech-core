import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractOwnerRequestedEmployees,
  toSelectedEmployeeRecommendations,
} from "./extractOwnerRequestedEmployees.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { createBuilderSession } from "./BuilderSession.js";

test("extracts AI caller, FB lead gen, and intake from owner language", () => {
  const matched = extractOwnerRequestedEmployees({
    answers: [{
      questionId: "q_digital_workforce",
      answer: "We need AI caller, FB lead generation, and intake",
    }],
  });
  assert.deepEqual(
    matched.map((entry) => entry.archetypeId).sort(),
    ["ai_caller", "facebook_lead_specialist", "intake_specialist"],
  );
  const recs = toSelectedEmployeeRecommendations(matched);
  assert.equal(recs.length, 3);
  assert.ok(recs.every((entry) => entry.selected));
});

test("assembly planner prioritizes owner-requested digital employees", () => {
  const session = createBuilderSession({
    businessSummary: {
      businessName: "Magna Mare",
      industry: "other",
      description: "Marketing agency",
    },
    answers: [{
      questionId: "q_digital_workforce",
      answer: "ai caller, fb lead generation, intake",
    }],
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  const labels = plan.selectedEmployees.map((entry) => entry.label);
  assert.ok(labels.some((label) => /AI Caller/i.test(label)));
  assert.ok(labels.some((label) => /Facebook Lead/i.test(label)));
  assert.ok(labels.some((label) => /Intake/i.test(label)));
  assert.equal(plan.selectedEmployees[0].label, "AI Caller");
});
