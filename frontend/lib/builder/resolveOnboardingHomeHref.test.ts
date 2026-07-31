import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOnboardingHomeHref } from "./resolveOnboardingHomeHref.ts";

test("no sessions — falls back to a fresh, sessionless discovery conversation", () => {
  const result = resolveOnboardingHomeHref({ businessId: "biz_1", sessions: [] });
  assert.equal(result.href, "/b/biz_1/architect");
  assert.equal(result.sessionId, null);
});

test("discovery in progress — resumes the in-business session, not a bare architect link", () => {
  const result = resolveOnboardingHomeHref({
    businessId: "biz_1",
    sessions: [{ sessionId: "abs_1", stageKey: "interviewing", updatedAt: "2026-01-02T00:00:00.000Z" }],
  });
  assert.equal(result.href, "/b/biz_1/architect?sessionId=abs_1");
  assert.equal(result.sessionId, "abs_1");
});

for (const stageKey of ["dry_run_ready", "awaiting_approval", "installing", "failed"]) {
  test(`session at ${stageKey} routes to the global install/recovery trail`, () => {
    const result = resolveOnboardingHomeHref({
      businessId: "biz_1",
      sessions: [{ sessionId: "abs_2", stageKey, updatedAt: "2026-01-02T00:00:00.000Z" }],
    });
    assert.equal(result.href, "/architect/abs_2/install");
    assert.equal(result.stageKey, stageKey);
  });
}

test("session claiming installed (no canonical OS, since Home only calls this pre-install) self-heals via install page", () => {
  const result = resolveOnboardingHomeHref({
    businessId: "biz_1",
    sessions: [{ sessionId: "abs_3", stageKey: "installed", updatedAt: "2026-01-02T00:00:00.000Z" }],
  });
  assert.equal(result.href, "/architect/abs_3/install");
});

test("archived sessions are ignored — falls back to a fresh conversation", () => {
  const result = resolveOnboardingHomeHref({
    businessId: "biz_1",
    sessions: [{ sessionId: "abs_old", stageKey: "archived", updatedAt: "2026-01-01T00:00:00.000Z" }],
  });
  assert.equal(result.href, "/b/biz_1/architect");
  assert.equal(result.sessionId, null);
});

test("prefers the first (most recently updated) resumable session in the list", () => {
  const result = resolveOnboardingHomeHref({
    businessId: "biz_1",
    sessions: [
      { sessionId: "abs_newest", stageKey: "awaiting_approval", updatedAt: "2026-01-03T00:00:00.000Z" },
      { sessionId: "abs_older", stageKey: "interviewing", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
  });
  assert.equal(result.sessionId, "abs_newest");
  assert.equal(result.href, "/architect/abs_newest/install");
});
