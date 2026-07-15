import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveWorkQueueCounts,
  filterWorkItems,
  isOverdueWorkItem,
  canApproveCampaignFromWorkDetail,
  resolveTargetWorkItem,
  resolveCampaignReview,
  resolveWorkRowHref,
  resolveCampaignApprovalPresentation,
  shouldShowCampaignApprovalHelper,
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

test("resolveTargetWorkItem deep-links completed work by id so outcomes stay reviewable", () => {
  const items = [
    makeItem({ id: "work_current", status: "in_progress" }),
    makeItem({ id: "work_done", status: "completed" }),
  ];

  assert.equal(resolveTargetWorkItem(items, "work_current")?.id, "work_current");
  assert.equal(resolveTargetWorkItem(items, "work_missing"), null);
  assert.equal(resolveTargetWorkItem(items, "work_done")?.id, "work_done");
  assert.equal(resolveTargetWorkItem(items, ""), null);
});

test("resolveWorkRowHref prefers workId deep-link when provided", () => {
  assert.equal(
    resolveWorkRowHref(
      {
        engagementHref: "/engagement/tm_system",
        personHref: "/b/biz_1/people/party_jane",
      },
      "biz_1",
      "work_9",
    ),
    "/b/biz_1/work?workId=work_9",
  );
});

test("campaign review semantics expose draft content only from selected Work context", () => {
  const campaignWork = makeItem({
    id: "work_campaign",
    status: "review_required",
    metadata: {
      campaignPreparation: {
        campaignName: "Weekly client newsletter",
        purpose: "Prepare a weekly relationship newsletter.",
        occurrenceKey: "2026-07-08",
        approvalStatus: "pending_review",
        communicationStatus: "draft",
        recipientCount: 1,
        excludedCount: 0,
        cta: "Reply if you want to talk.",
        knowledgeSummary: "No approved knowledge documents were retrieved by this campaign draft composer.",
        evidenceSummary: "Audience is based on canonical relationship evidence.",
        recipientPreparations: [
          {
            partyId: "party_alex",
            displayName: "Alex Morgan",
            subject: "This week's real estate and property update",
            body: "Hi Alex,\n\nHere is a draft update prepared from canonical relationship and business evidence.",
            personalizationSummary: ["prospect relationship"],
          },
        ],
      },
    },
  });
  const review = resolveCampaignReview(campaignWork);

  assert.equal(review?.draftSubject, "This week's real estate and property update");
  assert.match(String(review?.draftBody), /canonical relationship/);
  assert.equal(review?.recipients[0].displayName, "Alex Morgan");
  assert.equal(canApproveCampaignFromWorkDetail(campaignWork), true);
  assert.equal(shouldShowCampaignApprovalHelper(campaignWork), false);
  assert.equal(canApproveCampaignFromWorkDetail(makeItem({ metadata: {} })), false);
  const emptyReviewWork = makeItem({
    status: "review_required",
    metadata: { campaignPreparation: { recipientPreparations: [], recipientCount: 0 } },
  });
  assert.equal(canApproveCampaignFromWorkDetail(emptyReviewWork), false);
  assert.equal(shouldShowCampaignApprovalHelper(emptyReviewWork), true);
  assert.equal(shouldShowCampaignApprovalHelper(makeItem({
    status: "approved",
    metadata: {
      campaignPreparation: {
        approvalStatus: "approved",
        communicationStatus: "queued",
        recipientPreparations: [{ partyId: "party_alex", subject: "Subject", body: "Body" }],
      },
    },
  })), false);
});

test("campaign approval presentation transitions after one successful approval response", () => {
  const campaignWork = makeItem({
    id: "work_campaign",
    status: "review_required",
    metadata: {
      campaignPreparation: {
        approvalStatus: "pending_review",
        communicationStatus: "draft",
        recipientPreparations: [
          {
            partyId: "party_alex",
            displayName: "Alex Morgan",
            subject: "This week's real estate and property update",
            body: "Hi Alex, here is the draft.",
          },
        ],
      },
    },
  });

  assert.deepEqual(
    resolveCampaignApprovalPresentation(campaignWork),
    {
      statusLabel: "Draft pending review",
      buttonLabel: "Approve and queue",
      canApprove: true,
      showApprovalHelper: false,
      isQueued: false,
    },
  );
  assert.equal(resolveCampaignApprovalPresentation(campaignWork, { requestPending: true }).canApprove, false);
  assert.deepEqual(
    resolveCampaignApprovalPresentation(campaignWork, { optimisticQueued: true }),
    {
      statusLabel: "Approved and queued, not sent",
      buttonLabel: "Approved and queued",
      canApprove: false,
      showApprovalHelper: false,
      isQueued: true,
    },
  );
});
