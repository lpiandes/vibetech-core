import test from "node:test";
import assert from "node:assert/strict";
import { ApprovalRuntime } from "./ApprovalRuntime.js";
import {
  syncPendingDecisionDraftsToApprovals,
  approvalIdForDecisionDraft,
} from "./syncPendingDecisionDraftsToApprovals.js";

test("syncPendingDecisionDraftsToApprovals creates PENDING approvals for pending drafts", () => {
  const approvalRuntime = new ApprovalRuntime({ nowISO: "2026-07-27T12:00:00.000Z" });
  const result = syncPendingDecisionDraftsToApprovals({
    approvalRuntime,
    businessId: "biz_1",
    pendingDecisionDrafts: [
      {
        id: "draft_form_1",
        channel: "email",
        status: "pending_approval",
        subject: "Thanks",
        bodyPreview: "We got your inquiry",
        recipientEmail: "lead@example.com",
        source: "website_form_prove",
        createdAt: "2026-07-27T11:00:00.000Z",
      },
    ],
  });
  assert.equal(result.synced, 1);
  const apr = approvalRuntime.getRequestById(approvalIdForDecisionDraft("draft_form_1"));
  assert.ok(apr);
  assert.equal(apr.status, "PENDING");
  assert.equal(apr.source, "pending_decision_draft");
  assert.equal(apr.context.bodyPreview, "We got your inquiry");
});

test("syncPendingDecisionDraftsToApprovals is idempotent", () => {
  const approvalRuntime = new ApprovalRuntime({ nowISO: "2026-07-27T12:00:00.000Z" });
  const drafts = [{ id: "draft_a", status: "pending_approval", bodyPreview: "hi", channel: "email" }];
  syncPendingDecisionDraftsToApprovals({ approvalRuntime, pendingDecisionDrafts: drafts });
  const second = syncPendingDecisionDraftsToApprovals({ approvalRuntime, pendingDecisionDrafts: drafts });
  assert.equal(second.synced, 0);
  assert.equal(approvalRuntime.getRequests().filter((r) => r.status === "PENDING").length, 1);
});

test("syncPendingDecisionDraftsToApprovals skips already decided drafts", () => {
  const approvalRuntime = new ApprovalRuntime({ nowISO: "2026-07-27T12:00:00.000Z" });
  const result = syncPendingDecisionDraftsToApprovals({
    approvalRuntime,
    pendingDecisionDrafts: [{ id: "draft_done", status: "approved", bodyPreview: "x" }],
  });
  assert.equal(result.synced, 0);
  assert.equal(approvalRuntime.getRequests().length, 0);
});
