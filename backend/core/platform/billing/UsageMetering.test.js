import test from "node:test";
import assert from "node:assert/strict";
import {
  peekUsage,
  recordUsage,
  recordUsageSafe,
  listUsageMeters,
  resetUsageMetersForTests,
} from "./UsageMetering.js";

test("usage meters include SMS and voice", () => {
  const ids = listUsageMeters().map((m) => m.id);
  assert.ok(ids.includes("sms_segments"));
  assert.ok(ids.includes("voice_minutes_inbound"));
});

test("recordUsage increments and computes overage", () => {
  const first = recordUsage({ businessId: "biz_meter_1", meterId: "sms_segments", quantity: 1000 });
  assert.equal(first.used, 1000);
  assert.equal(first.remaining, 0);
  const next = recordUsage({ businessId: "biz_meter_1", meterId: "sms_segments", quantity: 10 });
  assert.equal(next.overageUnits, 10);
  assert.ok(next.overageUsd > 0);
  const peek = peekUsage({ businessId: "biz_meter_1", meterId: "sms_segments" });
  assert.equal(peek.used, 1010);
});

test("recordUsageSafe never throws and falls back to memory when store methods are missing", () => {
  resetUsageMetersForTests();
  const result = recordUsageSafe({ businessId: "biz_meter_safe", meterId: "sms_segments", quantity: 2 });
  assert.equal(result.ok, true);
  assert.equal(result.used, 2);

  const noop = recordUsageSafe({ businessId: "biz_meter_safe", meterId: "sms_segments", quantity: 1, platformStore: {} });
  assert.equal(noop.ok, true);
  assert.equal(noop.used, 3);

  const invalid = recordUsageSafe({ businessId: "", meterId: "not_a_meter" });
  assert.equal(invalid.ok, false);
});

test("recordUsage prefers a durable platformStore meter over memory when available", () => {
  resetUsageMetersForTests();
  let incremented = null;
  const platformStore = {
    incrementUsageMeter({ businessId, meterId, month, quantity }) {
      incremented = { businessId, meterId, month, quantity };
      return { used: 500 };
    },
  };
  const result = recordUsage({ businessId: "biz_durable", meterId: "sms_segments", quantity: 5, platformStore });
  assert.equal(result.used, 500);
  assert.ok(incremented);
  assert.equal(incremented.businessId, "biz_durable");
  assert.equal(incremented.quantity, 5);
});

test("peekUsage falls back to memory when platformStore.getUsageMeter throws", () => {
  resetUsageMetersForTests();
  recordUsage({ businessId: "biz_fallback", meterId: "emails", quantity: 4 });
  const platformStore = {
    getUsageMeter() {
      throw new Error("durable store unavailable");
    },
  };
  const peek = peekUsage({ businessId: "biz_fallback", meterId: "emails", platformStore });
  assert.equal(peek.ok, true);
  assert.equal(peek.used, 4);
});
