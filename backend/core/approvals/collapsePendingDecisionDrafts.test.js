import test from "node:test";
import assert from "node:assert/strict";
import {
  collapsePendingDecisionDrafts,
  upsertPendingDecisionDraft,
} from "./collapsePendingDecisionDrafts.js";
import {
  syncPendingDecisionDraftsToApprovals,
  pruneStaleDecisionDraftApprovals,
  approvalIdForDecisionDraft,
} from "./syncPendingDecisionDraftsToApprovals.js";
import { ApprovalRuntime } from "./ApprovalRuntime.js";

test("collapsePendingDecisionDrafts keeps one pending prove draft per source", () => {
  const collapsed = collapsePendingDecisionDrafts([
    { id: "a", source: "website_form_prove", status: "pending_approval", createdAt: "2026-01-01T00:00:00.000Z", subject: "Thanks" },
    { id: "b", source: "website_form_prove", status: "pending_approval", createdAt: "2026-01-02T00:00:00.000Z", subject: "Thanks" },
    { id: "c", source: "website_form_prove", status: "pending_approval", createdAt: "2026-01-03T00:00:00.000Z", subject: "Thanks" },
    { id: "m", source: "marketing", status: "pending_approval", createdAt: "2026-01-01T00:00:00.000Z", subject: "Promo" },
  ]);
  const prove = collapsed.filter((d) => d.source === "website_form_prove");
  assert.equal(prove.length, 1);
  assert.equal(prove[0].id, "c");
  assert.ok(collapsed.some((d) => d.id === "m"));
});

test("upsertPendingDecisionDraft replaces prior prove drafts", () => {
  const next = upsertPendingDecisionDraft(
    [
      { id: "old", source: "website_form_prove", status: "pending_approval", createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    { id: "new", source: "website_form_prove", status: "pending_approval", createdAt: "2026-01-04T00:00:00.000Z" },
  );
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "new");
});

test("pruneStaleDecisionDraftApprovals cancels removed prove cards", () => {
  const approvalRuntime = new ApprovalRuntime({ nowISO: () => "2026-01-05T00:00:00.000Z" });
  syncPendingDecisionDraftsToApprovals({
    approvalRuntime,
    businessId: "biz",
    pendingDecisionDrafts: [
      { id: "old", source: "website_form_prove", status: "pending_approval", subject: "Thanks", bodyPreview: "x" },
      { id: "keep", source: "website_form_prove", status: "pending_approval", subject: "Thanks", bodyPreview: "y" },
    ],
    pruneStale: false,
  });
  assert.equal(
    approvalRuntime.getRequests().filter((r) => r.status === "PENDING").length,
    2,
  );

  const collapsed = [{ id: "keep", source: "website_form_prove", status: "pending_approval", subject: "Thanks", bodyPreview: "y" }];
  pruneStaleDecisionDraftApprovals({
    approvalRuntime,
    pendingDecisionDrafts: collapsed,
  });
  const pending = approvalRuntime.getRequests().filter((r) => r.status === "PENDING");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, approvalIdForDecisionDraft("keep"));
});
