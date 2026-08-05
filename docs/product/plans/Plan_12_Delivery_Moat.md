---
name: RFT Delivery Moat
overview: Turn per-customer traces, exceptions, and approved rules into generalized blueprint patterns — never indiscriminate pooling of confidential customer data.
todos:
  - id: moat-pattern-extract
    content: Extract candidate patterns from root causes, Company Rules, autonomy classes (scrub PII/tenant secrets)
    status: completed
  - id: moat-blueprint-promote
    content: Promote generalized patterns into blueprint library with version + provenance
    status: completed
  - id: moat-operator-review
    content: Operator/admin review queue for pattern candidates before library publish
    status: completed
  - id: moat-tests
    content: Tests for scrubbing, no cross-tenant raw data leak, provenance required
    status: completed
isProject: false
---

# Plan 12: Delivery → moat

**Status:** DONE (2026-08-05)

## Goal
Promote generalized patterns from real delivery — assignment rules, proposal-stall definitions, consent boundaries, handoff requirements, scheduling exceptions, integration recovery — into the blueprint library. Moat is **proven operating patterns**, not imagined universality or pooled confidential data.

## Pattern sources
- Plan 8 operator root-cause roadmap feed  
- Plan 10 approved Company Rules / contract patches  
- Plan 11 earned autonomy class definitions  
- Replay/shadow failure classes (Plan 7)  
- Beachhead design-partner traces (evidence kinds only after scrub)  

## Approach
- Admin/operator surface (extend `/admin`) for **pattern candidates** — never auto-publish into customer installs.
- Scrub: strip names, emails, message bodies, provider account ids; keep structure (event types, SLA shapes, approval boundaries, exception codes).
- Promote into existing BlueprintRegistry / capability packages with `source: delivery_moat`, provenance (anonymized tenant count, date range, root-cause distribution).
- Customer install still goes through Architect/OS install — patterns are optional library improvements, not silent mutation of live contracts.

## Concrete commit
Operator can review ≥1 scrubbed pattern candidate derived from closed interventions or approved rules and promote it to a blueprint/package entry with provenance. Attempting to promote raw customer content fails closed.

## Ships when
At least one generalized pattern (e.g. proposal-stall follow-up rule shape or ack SLA default) is in the library with provenance, and tests prove PII scrubbing + no cross-tenant raw payload storage.

## Depends on
Plans 8 and 10 (volume of classified failures + approved rules). Plan 11 optional for autonomy-pattern promotion.

## Unblocks
Faster design-partner installs; compounding RFT beachhead advantage without CRM feature sprawl.

## Shipped
- Module: `backend/core/company-rules/deliveryMoat.js` (+ tests, 6/6)
- Source: `delivery_moat` on `BLUEPRINT_SOURCES`
- API: `/api/admin/delivery-moat` (extract | promote | reject | refuse_raw)
- UI: `/admin/patterns` + Blueprints source column
- Fail-closed scrub; anonymized tenant counts only; no live-contract auto-apply
