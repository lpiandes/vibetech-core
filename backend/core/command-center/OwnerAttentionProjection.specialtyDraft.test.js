import test from "node:test";
import assert from "node:assert/strict";
import { projectOwnerAttention } from "./OwnerAttentionProjection.js";

test("open specialty drafts project onto Home attention with glance copy", () => {
  const attention = projectOwnerAttention({
    workRuntime: {
      getWorkItems: () => [{
        id: "work_draft_1",
        workType: "custom_ai_task",
        status: "open",
        title: "Draft response",
        createdAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          customAi: true,
          needsYou: true,
          employeeDisplayName: "Intake specialist",
          triggerLabel: "Meta / Facebook lead",
          eventPayload: { name: "Alex Rivera", email: "alex@example.com" },
          glance: {
            title: "Intake specialist: Alex Rivera",
            summary: "Meta / Facebook lead · Alex Rivera",
            whyNeedsYou: "Open the draft and decide what happens next.",
            needsYou: true,
            workHref: "/b/biz_1/work?workId=work_draft_1",
          },
        },
      }],
    },
    approvalRuntime: { getRequests: () => [] },
    presentation: { businessId: "biz_1" },
    nowISO: "2026-07-26T14:00:00.000Z",
  });

  const draft = attention.find((item) => item.sourceType === "specialty_draft");
  assert.ok(draft);
  assert.equal(draft.title, "Intake specialist: Alex Rivera");
  assert.match(draft.summary, /Meta \/ Facebook lead/);
  assert.equal(draft.availableActions[0].href, "/b/biz_1/work?workId=work_draft_1");
});

test("auto specialty drafts stay out of Needs you", () => {
  const attention = projectOwnerAttention({
    workRuntime: {
      getWorkItems: () => [{
        id: "work_auto_1",
        workType: "custom_ai_task",
        status: "open",
        metadata: {
          customAi: true,
          needsYou: false,
          glance: {
            title: "Teammate prepared a draft",
            summary: "Ran automatically",
            needsYou: false,
            whyNeedsYou: "Ran automatically — no owner action required.",
            workHref: "/b/biz_1/work?workId=work_auto_1",
          },
        },
      }],
    },
    approvalRuntime: { getRequests: () => [] },
    presentation: { businessId: "biz_1" },
    nowISO: "2026-07-26T14:00:00.000Z",
  });
  assert.equal(attention.filter((item) => item.sourceType === "specialty_draft").length, 0);
});

test("specialty draft without stored glance still builds a generic card", () => {
  const attention = projectOwnerAttention({
    workRuntime: {
      getWorkItems: () => [{
        id: "work_draft_2",
        workType: "custom_ai_task",
        status: "open",
        title: "Prepared work",
        createdAt: "2026-07-26T12:00:00.000Z",
        metadata: {
          customAi: true,
          employeeName: "Scheduler",
          triggerLabel: "New booking request",
          eventPayload: { name: "Sam Lee" },
        },
      }],
    },
    approvalRuntime: { getRequests: () => [] },
    presentation: { businessId: "biz_2" },
    nowISO: "2026-07-26T12:30:00.000Z",
  });

  const draft = attention.find((item) => item.sourceType === "specialty_draft");
  assert.ok(draft);
  assert.match(draft.title, /Scheduler.*Sam Lee/);
  assert.match(draft.summary, /New booking request/);
  assert.match(draft.availableActions[0].href, /\/b\/biz_2\/work\?workId=work_draft_2/);
});

test("pending approval for same work suppresses duplicate specialty draft attention", () => {
  const attention = projectOwnerAttention({
    workRuntime: {
      getWorkItems: () => [{
        id: "work_draft_3",
        workType: "custom_ai_task",
        status: "open",
        metadata: {
          customAi: true,
          glance: {
            title: "Teammate: Pat",
            summary: "Lead form · Pat",
            whyNeedsYou: "Approve the email/text before anything sends.",
            workHref: "/b/biz_3/work?workId=work_draft_3",
          },
        },
      }],
    },
    approvalRuntime: {
      getRequests: () => [{
        id: "appr_1",
        status: "PENDING",
        title: "Send SMS",
        relatedWorkId: "work_draft_3",
        createdAt: "2026-07-26T12:00:00.000Z",
      }],
    },
    presentation: { businessId: "biz_3" },
    nowISO: "2026-07-26T12:05:00.000Z",
  });

  assert.equal(attention.filter((item) => item.sourceType === "specialty_draft").length, 0);
  const approval = attention.find((item) => item.sourceType === "approval");
  assert.ok(approval);
  assert.equal(approval.title, "Teammate: Pat");
});
