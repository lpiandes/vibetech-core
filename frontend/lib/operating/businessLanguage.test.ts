import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ASK_VIBETECH_SUGGESTIONS,
  buildAskSuggestions,
  scrubInternalWording,
  humanizeEnumLabel,
  looksLikeInternalId,
} from "../../../frontend/lib/operating/businessLanguage.ts";

test("business language scrubber removes internal wording", () => {
  assert.equal(scrubInternalWording("from canonical evidence"), "from supporting records");
  assert.equal(scrubInternalWording("open vibetech_app"), "open VIBETech");
  assert.equal(humanizeEnumLabel("IN_PROGRESS"), "In Progress");
  assert.equal(looksLikeInternalId("snap_abc"), true);
  assert.equal(looksLikeInternalId("Follow-up completed"), false);
});

test("Ask VIBETech suggestions default to operating questions", () => {
  assert.deepEqual([...ASK_VIBETECH_SUGGESTIONS], [
    "Why was the latest opportunity escalated?",
    "Show every proposal without a next step.",
    "What needs my approval?",
    "What changed today?",
    "Which rule is causing the most escalations?",
    "Where are we missing evidence?",
    "Change response promise to one hour.",
  ]);
  assert.deepEqual(buildAskSuggestions(), [...ASK_VIBETECH_SUGGESTIONS]);
});

test("buildAskSuggestions stays inside supported prompt set", () => {
  assert.deepEqual(buildAskSuggestions({ approvalCount: 2 }), [
    "What needs my approval?",
    "What changed today?",
    "Which rule is causing the most escalations?",
  ]);
  assert.deepEqual(buildAskSuggestions({ winCount: 1 }), [
    "What changed today?",
    "Which rule is causing the most escalations?",
    "Change response promise to one hour.",
  ]);
});
