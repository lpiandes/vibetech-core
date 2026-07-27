import test from "node:test";
import assert from "node:assert/strict";

import { OptionalAIBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";

test("OptionalAI refineAnswer never demotes a concrete answer to unknown", async () => {
  const client = {
    async refineAnswer() {
      return {
        fields: { goals: ["grow"] },
        unknown: true,
        note: "model wrongly marked unknown",
      };
    },
  };
  const provider = new OptionalAIBuilderIntelligenceProvider({ enabled: true, client });
  const refined = await provider.refineAnswer({
    questionId: "q_desired_outcomes",
    answer: "Answer every missed call in 30 days",
    interpreted: { fields: { goals: ["Answer every missed call in 30 days"] }, unknown: false },
  });
  assert.equal(refined.unknown, false);
  assert.equal(refined.fields.goals[0], "grow");
});
