import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveWorkQueueCounts,
  filterWorkItems,
  isOverdueWorkItem,
  resolveTargetWorkItem,
  resolveWorkRowHref,
  sortWorkQueueItems,
} from "./workQueueSemantics.ts";

const NOW = "2026-07-01T00:00:00.000Z";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "wi_1",
    title: "Follow up with prospect",
    status: "in_progress",
    priority: "high",
    dueAt: "2026-06-30T00:00:00.000Z",
    metadata: {
      display: {
        workTypeLabel: "Prospect follow-up",
        statusLabel: "In progress",
        partyName: "Alex Rivera",
        subjectName: "12 Harbor View",
        subjectId: "sub_1",
        overdue: true,
        dueLabel: "Jun 30",
        nextStep: "Waiting for confirmation",
        engagementHref: "/engagement/party_1",
      },
    },
    ...overrides,
  };
}

test("work queue counts stay aligned with VM metrics", () => {
  const items = [
    makeItem({ id: "wi_1", status: "in_progress" }),
    makeItem({ id: "wi_2", status: "blocked", metadata: { display: { overdue: false } } }),
    makeItem({ id: "wi_3", status: "waiting", metadata: { display: { overdue: false } } }),
    makeItem({ id: "wi_4", status: "completed", metadata: { display: { overdue: false } } }),
  ];

  const counts = deriveWorkQueueCounts(items, {
    openWork: 3,
    blockedWork: 1,
    overdueWork: 1,
  });

  assert.equal(counts.open, 3);
  assert.equal(counts.blocked, 1);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.waiting, 1);
  assert.equal(counts.all, 3);
});

test("filters use adapter overdue semantics and active-work boundaries", () => {
  const items = [
    makeItem({ id: "wi_open", status: "in_progress" }),
    makeItem({ id: "wi_blocked", status: "blocked", metadata: { display: { overdue: false } } }),
    makeItem({ id: "wi_done", status: "completed", metadata: { display: { overdue: false } } }),
  ];

  assert.equal(filterWorkItems(items, "all").length, 2);
  assert.equal(filterWorkItems(items, "open").length, 2);
  assert.equal(filterWorkItems(items, "blocked").length, 1);
  assert.equal(filterWorkItems(items, "overdue").length, 1);
  assert.equal(isOverdueWorkItem(makeItem(), NOW), true);
});

test("sorting prioritizes overdue and blocked work", () => {
  const sorted = sortWorkQueueItems([
    makeItem({ id: "wi_ok", status: "in_progress", priority: "normal", metadata: { display: { overdue: false } } }),
    makeItem({ id: "wi_blocked", status: "blocked", priority: "normal", metadata: { display: { overdue: false } } }),
    makeItem({ id: "wi_overdue", status: "in_progress", priority: "normal", metadata: { display: { overdue: true } } }),
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["wi_overdue", "wi_blocked", "wi_ok"],
  );
});

test("resolveWorkRowHref never uses legacy engagement routes in business scope", () => {
  assert.equal(
    resolveWorkRowHref(
      {
        engagementHref: "/engagement/tm_system",
        personHref: "/b/biz_1/people/party_jane",
        subjectId: "subj_1",
      },
      "biz_1",
    ),
    "/b/biz_1/people/party_jane",
  );

  assert.equal(
    resolveWorkRowHref(
      {
        engagementHref: "/engagement/tm_system",
        subjectId: "subj_main",
      },
      "biz_1",
    ),
    "/b/biz_1/properties/subj_main",
  );

  assert.equal(
    resolveWorkRowHref(
      {
        engagementHref: "/engagement/tm_system",
      },
      "biz_1",
    ),
    null,
  );
});

test("resolveTargetWorkItem opens only active work present in the current business queue", () => {
  const items = [
    makeItem({ id: "work_current", status: "in_progress" }),
    makeItem({ id: "work_done", status: "completed" }),
  ];

  assert.equal(resolveTargetWorkItem(items, "work_current")?.id, "work_current");
  assert.equal(resolveTargetWorkItem(items, "work_missing"), null);
  assert.equal(resolveTargetWorkItem(items, "work_done"), null);
  assert.equal(resolveTargetWorkItem(items, ""), null);
});
