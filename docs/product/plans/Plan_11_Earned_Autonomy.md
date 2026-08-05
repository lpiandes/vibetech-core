---
name: RFT Earned Autonomy
overview: Per action-class autonomy eligibility from risk, confidence, evidence, approval/edit rates, incidents, policy version, and delegation — never blanket auto-send.
todos:
  - id: autonomy-action-classes
    content: Define RFT action-class catalog + eligibility inputs (risk, evidence, rates, incidents, policy version)
    status: completed
  - id: autonomy-eligibility-engine
    content: Compute per-class eligibility; default deny; integrate with AutoEligible vs ApprovalRequired
    status: completed
  - id: autonomy-ui-gates
    content: Owner/operator visibility of what may auto; revoke/delegation controls; go-live still respects Plan 7 gates
    status: completed
  - id: autonomy-tests
    content: Tests proving high-edit or incident classes stay gated; eligible classes can AutoEligible
    status: completed
isProject: false
---

# Plan 11: Earned autonomy

**Status:** DONE (2026-08-05)

## Goal
Autonomy is **earned per action class**, not granted globally. Example: existing-customer scheduling at 97% approval / 0 critical corrections → auto eligible; new-customer pricing at high edit rate → not eligible.

## Eligibility inputs (minimum)
- Risk tier of the action class  
- Confidence / evidence completeness  
- Approval rate and **edit** rate  
- Incident / Exception / operator root-cause frequency  
- Active **policy / contract version** (invalidate on version bump until re-earned)  
- Explicit **delegation** (owner opt-in per class)  

## Approach
- Catalog action classes aligned to RFT permitted actions + specialty path step types (ack email, schedule, proposal send, pricing exception, etc.).
- Persist eligibility on `installation.configuration.rftAutonomy` (per-class scores, thresholds, delegatedAt, revokedAt).
- Wire into RFT progress (`AutoEligible` vs `ApprovalRequired`) and specialty `runMode` / approval gates — reuse, don’t fork.
- Shadow/replay (Plan 7) remain prerequisites for elevating a class; Plan 10 correction rates feed the math.
- Owner UI under Company Rules or Launch: “What can run without me?” with revoke.

## Concrete commit
At least two action classes compute eligibility from real approval/edit history; one can become AutoEligible when thresholds + delegation pass; one stays ApprovalRequired when edit rate is high. Version bump clears auto until re-earned.

## Ships when
A design partner can see which classes are auto-eligible, revoke one, and observe ApprovalRequired again — with tests that block fabricated eligibility.

## Depends on
Plans 7 and 10. Plan 2 state machine. Plan 8 incidents optional but valuable.

## Unblocks
Honest “hands-off” delivery; Plan 12 promotion of autonomy patterns into blueprints.

## Shipped
- Module: `backend/core/company-rules/earnedAutonomy.js` (+ tests, 6/6)
- Catalog: scheduling, new-prospect outbound, pricing exception, internal CRM
- API: `GET/POST /api/businesses/[businessId]/earned-autonomy` (refresh | delegate | revoke)
- Wired: `classifyReplayOpportunity`, RFT opportunity progress (ActionProposed → Auto/Approval), Company Rules UI
- Gates: Plan 7 replay+shadow required; default deny; policy hash mismatch clears auto
