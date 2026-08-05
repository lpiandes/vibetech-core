---
name: Demo Ops Honesty
overview: Demo/design-partner path requires a real or controlled event; refresh checklist and runbook for shipped Plans 10–12.
todos:
  - id: demo-gate
    content: Demo/outcome success path requires evidence-backed event
    status: completed
  - id: docs-refresh
    content: Update BEACHHEAD_PROVE_CHECKLIST + DESIGN_PARTNER_RUNBOOK for Plans 10–12
    status: completed
isProject: false
---

# Plan 18: Demo honesty + ops docs

**Status:** DONE

## Goal
No empty-state “success.” Ops docs match the shipped product (learning, autonomy, Decisions, RFT launch).

## Concrete commit
Checklist/runbook drop “until Plan X ships” for 4/10/11; point owners to Decisions + earned autonomy + Company Rules. Demo or fixture path refuses fabricated completed Outcomes without provider evidence.

## Ships when
Docs are current and at least one honesty gate blocks unproven “completed” demo claims.

## Shipped
- `BEACHHEAD_PROVE_CHECKLIST.md` — RFT Launch Path, Decisions, Company Rules learning/autonomy, `/admin/patterns`; Outcomes evidence gate
- `DESIGN_PARTNER_RUNBOOK.md` — same honesty updates; Ask confirm + Outcomes proof metrics
- Code honesty gate: `composeOutcomesLedger` marks unproven recent outcomes and excludes from completed counts

## Depends on
Plans 13–17 (docs can land as each ships; final pass here).
