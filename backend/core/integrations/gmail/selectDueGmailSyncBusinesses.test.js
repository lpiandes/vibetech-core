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

test("still works correctly with a larger candidate pool and higher maxPerTick (scaled-up caps)", () => {
  // Mirrors the production caps in runHostedPlatformJobTick.ts
  // (GMAIL_SYNC_CANDIDATE_POOL=100, GMAIL_SYNC_MAX_PER_TICK=8): a pool larger
  // than maxPerTick should still return exactly maxPerTick due businesses,
  // oldest-synced-first, with never-synced ones prioritized.
  const candidates = [
    ...Array.from({ length: 90 }, (_, i) => ({
      businessId: `biz_recent_${i}`,
      installation: installationWithLastSync("2026-07-30T17:59:00.000Z"), // inside min interval
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      businessId: `biz_never_${i}`,
      installation: installationWithLastSync(null),
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      businessId: `biz_stale_${i}`,
      installation: installationWithLastSync(`2026-07-30T${10 + i}:00:00.000Z`), // well outside min interval
    })),
  ];
  assert.equal(candidates.length, 100);
  const due = selectDueGmailSyncBusinesses({ candidates, nowISO: NOW, maxPerTick: 8, minIntervalMs: 10 * 60 * 1000 });
  assert.equal(due.length, 8);
  assert.ok(due.every((id) => id.startsWith("biz_never_") || id.startsWith("biz_stale_")));
  // Never-synced businesses come first (5 of them), then oldest-stale first.
  assert.equal(due.filter((id) => id.startsWith("biz_never_")).length, 5);
  assert.deepEqual(due.slice(5), ["biz_stale_0", "biz_stale_1", "biz_stale_2"]);
});

test("candidates with a missing installation are skipped", () => {
  const candidates = [
    { businessId: "biz_missing", installation: null },
    { businessId: "biz_ok", installation: installationWithLastSync(null) },
  ];
  const due = selectDueGmailSyncBusinesses({ candidates, nowISO: NOW, maxPerTick: 5 });
  assert.deepEqual(due, ["biz_ok"]);
});
