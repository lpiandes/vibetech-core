---
name: RFT Governed Learning
overview: Real learning loop — store original vs approved, classify why, associate to policy, detect repeats, propose Company Rules, replay, approve, version, rollback. Until this ships, do not claim the system continuously learns.
todos:
  - id: learn-capture
    content: Persist original proposal vs owner-approved/edited outcome with reason codes
    status: completed
  - id: learn-associate
    content: Associate corrections to policy/contract version + detect repeat patterns
    status: completed
  - id: learn-propose-rule
    content: Propose Company Rule from repeats; owner approve; version + rollback
    status: completed
  - id: learn-tests
    content: Tests for capture honesty, propose-not-auto-apply, version/rollback
    status: completed
isProject: false
---

# Plan 10: Governed learning

**Status:** DONE (2026-08-05)

## Goal
Only after this loop is live may we truthfully say the system “learns.” Until then: stores decisions, preserves context, records outcomes, proposes changes — nothing more.

## Learning loop
1. Store **original** model/proposal vs **approved/edited** owner result  
2. Classify **why** (reuse Plan 8 root-cause enum where applicable + edit-reason codes)  
3. Associate to **policy / contract version / Company Rule**  
4. Detect **repeats** (same class across opportunities)  
5. **Propose** a Company Rule (or RFT contract patch) — never silent apply  
6. Owner **approves**; rule is **versioned**  
7. **Replay** against recent history (Plan 7) before broad enable  
8. **Rollback** if incidents rise  

## Approach
- Persist on `installation.configuration.governedLearning` (corrections, proposals, rule versions) — extend; no parallel brain.
- Feed from Approvals (grant/reject/edit), Ask command drafts (Plan 9), operator interventions (Plan 8), shadow corrections (Plan 7).
- Company Rules UI (`/knowledge` / Company Rules) becomes the owner surface for proposed rules.
- Constitution gate: DEVELOPMENT_FREEZE forbids “continuously learns” marketing until this plan is DONE.

## Concrete commit
N corrections of the same class → visible proposed Company Rule with evidence links → owner approve → version bump → rollback API restores prior version. Auto-apply of rules is forbidden in this plan.

## Ships when
A design-partner correction path can produce an approved, versioned Company Rule with rollback, and replay is offered before enable. Product copy that claims learning is allowed only after this.

## Depends on
Plans 3, 7 (Company Rules IA + replay). Plan 8 root causes strongly recommended. Plan 9 accelerates capture.

## Unblocks
Plan 11 earned autonomy (needs correction rates + policy versions); Plan 12 pattern promotion.

## Shipped
- Module: `backend/core/company-rules/governedLearning.js` (+ tests, 7/7)
- API: `GET/POST /api/businesses/[businessId]/governed-learning`
- Capture wired: approvals decision, operator resolve, shadow correct, Ask/contract patch (`fromAsk` / `learningCorrection`)
- UI: `GovernedLearningPanel` on Company Rules (Knowledge) — propose → replay → approve → rollback
