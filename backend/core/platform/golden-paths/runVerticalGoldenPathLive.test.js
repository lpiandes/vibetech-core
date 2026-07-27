/**
 * Golden path live runner + PM quarantine tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runVerticalGoldenPathLive } from "./runVerticalGoldenPathLive.js";
import { InMemoryPlatformJobQueue } from "../jobs/PlatformJobQueue.js";

test("sports golden path runs on injected queue", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-18T16:00:00.000Z" });
  const result = await runVerticalGoldenPathLive({
    vertical: "sports",
    businessId: "biz_sports_live",
    queue,
    outboundApproved: true,
    nowISO: "2026-07-18T16:00:00.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.vertical, "sports");
  assert.equal(result.queueBackend, "injected");
  assert.match(result.workHref, /\/b\/biz_sports_live\/work\?workId=/);
  assert.ok(result.seedJobId);
});

test("dental golden path runs on injected queue without PHI", async () => {
  const queue = new InMemoryPlatformJobQueue({ nowISO: () => "2026-07-18T16:00:00.000Z" });
  const result = await runVerticalGoldenPathLive({
    vertical: "dental",
    businessId: "biz_dental_live",
    queue,
    outboundApproved: true,
    nowISO: "2026-07-18T16:00:00.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.vertical, "dental");
  assert.equal(result.queueBackend, "injected");
});

test("PM workspace is rejected for sports/dental golden paths", async () => {
  await assert.rejects(
    () =>
      runVerticalGoldenPathLive({
        vertical: "sports",
        businessId: "biz_pm",
        workspaceGate: { industry: "property_management" },
      }),
    /PM workspace/,
  );
});
