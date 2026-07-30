import test from "node:test";
import assert from "node:assert/strict";

import { selectDueGmailSyncBusinesses } from "./selectDueGmailSyncBusinesses.js";

const NOW = "2026-07-30T18:00:00.000Z";

function installationWithLastSync(lastSyncAt) {
  return { configuration: { gmailInboxSync: lastSyncAt ? { lastSyncAt } : {} } };
}

test("never-synced businesses are selected before recently-synced ones", () => {
  const candidates = [
    { businessId: "biz_recent", installation: installationWithLastSync("2026-07-30T17:59:00.000Z") },
    { businessId: "biz_never", installation: installationWithLastSync(null) },
  ];
  const due = selectDueGmailSyncBusinesses({ candidates, nowISO: NOW, maxPerTick: 5 });
  assert.deepEqual(due, ["biz_never"], "recently-synced business is still inside the min interval");
});

test("businesses synced longer ago than minIntervalMs become due again, oldest first", () => {
  const candidates = [
    { businessId: "biz_a", installation: installationWithLastSync("2026-07-30T17:00:00.000Z") },
    { businessId: "biz_b", installation: installationWithLastSync("2026-07-30T16:00:00.000Z") },
    { businessId: "biz_c", installation: installationWithLastSync("2026-07-30T17:55:00.000Z") },
  ];
  const due = selectDueGmailSyncBusinesses({
    candidates,
    nowISO: NOW,
    minIntervalMs: 10 * 60 * 1000,
    maxPerTick: 5,
  });
  assert.deepEqual(due, ["biz_b", "biz_a"], "oldest lastSyncAt first; biz_c is still within the interval");
});

test("maxPerTick caps how many businesses are returned", () => {
  const candidates = Array.from({ length: 10 }, (_, i) => ({
    businessId: `biz_${i}`,
    installation: installationWithLastSync(null),
  }));
  const due = selectDueGmailSyncBusinesses({ candidates, nowISO: NOW, maxPerTick: 3 });
  assert.equal(due.length, 3);
});

test("candidates with a missing installation are skipped", () => {
  const candidates = [
    { businessId: "biz_missing", installation: null },
    { businessId: "biz_ok", installation: installationWithLastSync(null) },
  ];
  const due = selectDueGmailSyncBusinesses({ candidates, nowISO: NOW, maxPerTick: 5 });
  assert.deepEqual(due, ["biz_ok"]);
});
