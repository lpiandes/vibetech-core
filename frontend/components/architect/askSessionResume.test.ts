import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isContinuousImproveSession,
  pickResumableSessionId,
  presentAskHistory,
} from "./askSessionResume.ts";

test("package Ask sessions are never treated as continuous chat", () => {
  assert.equal(
    isContinuousImproveSession({
      sessionId: "abs_pkg",
      mode: "expand_existing_business",
      metadata: { packageAsk: true },
    }),
    false,
  );
  assert.equal(
    isContinuousImproveSession({
      sessionId: "abs_cfg",
      mode: "configure_existing_business",
      metadata: { packageAsk: true },
      businessSummary: { packageAsk: true },
    }),
    false,
  );
});

test("continuous Ask never resumes discovery leftovers", () => {
  const discovery = {
    sessionId: "abs_old",
    mode: "new_business",
    stageKey: "discovery",
    title: "Mind and Mobility",
  };
  const continuous = {
    sessionId: "abs_improve",
    mode: "continuous_improvement",
    metadata: { continuousImprovement: true },
    stageKey: "conversation",
    title: "Add referrals",
    preview: "Sounds good",
    updatedAt: "2026-07-12T12:00:00.000Z",
    canContinue: true,
    hasUserMessage: true,
    emptyAsk: false,
  };
  const emptyDraft = {
    sessionId: "abs_empty",
    mode: "expand_existing_business",
    continuousImprovement: true,
    title: "New conversation",
    preview: "Review how VIBETech recommends running your business",
    updatedAt: "2026-07-12T12:01:00.000Z",
    canContinue: true,
    emptyAsk: true,
    hasUserMessage: false,
    messageCount: 0,
  };

  assert.equal(isContinuousImproveSession(discovery), false);
  assert.equal(isContinuousImproveSession(continuous), true);
  assert.equal(
    pickResumableSessionId([discovery, continuous], { continuousOnly: true }),
    "abs_improve",
  );
  assert.equal(
    pickResumableSessionId([discovery], { continuousOnly: true }),
    null,
  );
  assert.equal(
    pickResumableSessionId([discovery], { continuousOnly: false }),
    "abs_old",
  );

  const history = presentAskHistory([discovery, continuous, emptyDraft], {
    activeSessionId: "abs_empty",
  });
  assert.equal(history.length, 2);
  assert.ok(history.some((item) => item.sessionId === "abs_improve"));
  assert.ok(history.some((item) => item.sessionId === "abs_old" && item.kind === "setup"));
  assert.ok(!history.some((item) => item.title === "New conversation"));
  assert.ok(!history.some((item) => /Review how VIBETech recommends/i.test(item.preview) && item.kind === "chat"));
});

test("Ask history keeps only the newest chat per identical title", () => {
  const older = {
    sessionId: "abs_1",
    continuousImprovement: true,
    title: "What should this teammate take on next?",
    preview: "old",
    updatedAt: "2026-07-12T10:00:00.000Z",
    canContinue: true,
    hasUserMessage: true,
  };
  const newer = {
    sessionId: "abs_2",
    continuousImprovement: true,
    title: "What should this teammate take on next?",
    preview: "new",
    updatedAt: "2026-07-12T12:00:00.000Z",
    canContinue: true,
    hasUserMessage: true,
  };
  const other = {
    sessionId: "abs_3",
    continuousImprovement: true,
    title: "Help me clear what's waiting",
    preview: "x",
    updatedAt: "2026-07-12T11:00:00.000Z",
    canContinue: true,
    hasUserMessage: true,
  };
  const history = presentAskHistory([older, newer, other]);
  assert.equal(history.length, 2);
  assert.equal(history[0].sessionId, "abs_2");
  assert.equal(history[1].sessionId, "abs_3");
});
