import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_ASK_LIMITS,
  checkAiAskQuota,
  resetAiAskQuotaForTests,
} from "./AiAskQuotaService.js";

test("ask quota allows 5 then blocks", async () => {
  resetAiAskQuotaForTests();
  const userId = "user_quota_test_1";
  for (let i = 0; i < AI_ASK_LIMITS.ask; i += 1) {
    const q = await checkAiAskQuota({ scope: "ask", userId, consume: true });
    assert.equal(q.allowed, true);
    assert.equal(q.remaining, AI_ASK_LIMITS.ask - (i + 1));
  }
  const blocked = await checkAiAskQuota({ scope: "ask", userId, consume: true });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "quota_exceeded");
  assert.equal(blocked.remaining, 0);
});

test("automation quota is per employee", async () => {
  resetAiAskQuotaForTests();
  const businessId = "biz_q";
  for (let i = 0; i < AI_ASK_LIMITS.automation; i += 1) {
    const q = await checkAiAskQuota({
      scope: "automation",
      businessId,
      employeeId: "emp_a",
      consume: true,
    });
    assert.equal(q.allowed, true);
  }
  const blockedA = await checkAiAskQuota({
    scope: "automation",
    businessId,
    employeeId: "emp_a",
    consume: true,
  });
  assert.equal(blockedA.allowed, false);

  const other = await checkAiAskQuota({
    scope: "automation",
    businessId,
    employeeId: "emp_b",
    consume: true,
  });
  assert.equal(other.allowed, true);
  assert.equal(other.remaining, AI_ASK_LIMITS.automation - 1);
});

test("peek does not consume", async () => {
  resetAiAskQuotaForTests();
  const peek = await checkAiAskQuota({
    scope: "ask",
    userId: "peek_user",
    consume: false,
  });
  assert.equal(peek.allowed, true);
  assert.equal(peek.used, 0);
  assert.equal(peek.remaining, 5);
  const after = await checkAiAskQuota({
    scope: "ask",
    userId: "peek_user",
    consume: false,
  });
  assert.equal(after.used, 0);
});
