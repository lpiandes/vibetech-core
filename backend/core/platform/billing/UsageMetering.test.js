import test from "node:test";
import assert from "node:assert/strict";
import { peekUsage, recordUsage, listUsageMeters } from "./UsageMetering.js";

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
