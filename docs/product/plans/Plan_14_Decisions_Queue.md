---
name: Decisions Judgment Queue
overview: Make Decisions the managerial Needs-you queue for RFT approvals/exceptions — not BI ideas.
todos:
  - id: decisions-queue-surface
    content: Primary Decisions UI lists approvals + RFT exceptions with evidence
    status: completed
  - id: decisions-actions
    content: Approve and send / Edit / Assign only / Reject wired to existing runtimes
    status: completed
  - id: decisions-tests
    content: Tests or UI contract that BI ideas are secondary
    status: completed
isProject: false
---

# Plan 14: Decisions judgment queue

**Status:** DONE

## Goal
Decisions answers: what needs human judgment now? Every item shows evidence, why blocked, proposed action, SLA risk, and managerial actions.

## Concrete commit
`/b/.../intelligence` (Decisions) leads with RFT/approval Needs-you items; BI candidates demoted. At least Approve and Reject (and Assign or Edit where hooks exist) work from that surface.

## Ships when
Owner can clear an RFT ApprovalRequired item from Decisions without visiting legacy Attention-only paths.

## Shipped
- `DecisionsQueue` component with Approve and send / Reject wired to `/api/approvals/{id}/decision` with `businessId`
- `/b/.../intelligence` leads with `attentionItems` from mission control; BI candidates demoted to **More → Suggestions**
- Page title/description reframed for managerial judgment
- `AttentionExecutiveLayout` reuses shared `DecisionsQueue`

## Depends on
Plans 3, 8, 13.
