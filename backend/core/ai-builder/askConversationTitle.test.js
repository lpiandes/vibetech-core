import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveAskConversationTitle,
  shouldAutoUpdateAskTitle,
  withAutoAskTitle,
} from "./askConversationTitle.js";

test("deriveAskConversationTitle names from the first real user message", () => {
  assert.equal(deriveAskConversationTitle([]), "New conversation");
  assert.equal(
    deriveAskConversationTitle([
      { role: "user", text: "hi" },
      { role: "user", text: "Help me clear stalled follow-ups this week" },
    ]),
    "Help me clear stalled follow-ups this week",
  );
  assert.match(
    deriveAskConversationTitle([
      { role: "user", text: "Can you explain what the maintenance coordinator needs approved and why it matters for owners" },
    ]),
    /maintenance coordinator/i,
  );
  assert.ok(
    deriveAskConversationTitle([
      { role: "user", text: "Can you explain what the maintenance coordinator needs approved and why it matters for owners" },
    ]).length <= 49,
  );
});

test("auto title updates only while still default and unlocked", () => {
  assert.equal(shouldAutoUpdateAskTitle({ askTitle: "New conversation" }, [{ role: "user", text: "Rename nav" }]), true);
  assert.equal(shouldAutoUpdateAskTitle({ askTitle: "Rename nav", askTitleAutoVersion: 1 }, [{ role: "user", text: "Rename nav" }]), false);
  assert.equal(shouldAutoUpdateAskTitle({ askTitleLocked: true, askTitle: "New conversation" }, [{ role: "user", text: "x" }]), false);

  const next = withAutoAskTitle({
    mode: "expand_existing_business",
    metadata: { continuousImprovement: true, askTitle: "New conversation", askTitleAutoVersion: 0 },
    conversation: [{ role: "user", text: "Add a referrals workspace" }],
  });
  assert.equal(next.metadata.askTitle, "Add a referrals workspace");
  assert.equal(next.metadata.askTitleAutoVersion, 1);
});
