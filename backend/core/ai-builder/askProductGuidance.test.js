import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTOMATION_HOWTO_REPLY,
  automationHowToReply,
  isAutomationHowToRequest,
} from "./askProductGuidance.js";
import { DeterministicBuilderIntelligenceProvider } from "./BuilderIntelligenceProvider.js";

test("detects automation how-to questions", () => {
  assert.equal(
    isAutomationHowToRequest({ text: "how do i change an automation?" }),
    true,
  );
  assert.equal(
    isAutomationHowToRequest({ text: "Where can I edit automations" }),
    true,
  );
});

test("detects confused follow-ups with automation context", () => {
  const session = {
    conversation: [
      { role: "user", text: "how do i change an automation?" },
      { role: "assistant", text: "Update workflow: Updated workflow" },
    ],
  };
  assert.equal(
    isAutomationHowToRequest({
      text: "that didnt make sense how do i change it?",
      session,
    }),
    true,
  );
});

test("does not treat explicit path edits as how-to", () => {
  assert.equal(
    isAutomationHowToRequest({
      text: "Add an SMS step to the parent communications automation",
    }),
    false,
  );
});

test("deterministic provider replies with Automations UI guidance", async () => {
  const provider = new DeterministicBuilderIntelligenceProvider();
  const result = await provider.interpretChangeRequest({
    text: "how do i change an automation?",
  });
  assert.equal(result.status, "reply");
  assert.equal(result.source, "product_guidance");
  assert.match(result.reply, /Automations/);
  assert.equal(result.reply, AUTOMATION_HOWTO_REPLY);
  assert.equal(automationHowToReply().reply, AUTOMATION_HOWTO_REPLY);
});
