---
name: Proof Metrics Fail Visibly
overview: Outcomes/Today show baseline delta, SLA, auto vs human; failed externals escalate to Exception; no unproven completed counts.
todos:
  - id: metrics-compose
    content: Extend outcomes ledger with evidence-backed metrics + not_observable
    status: completed
  - id: fail-visible
    content: Specialty/external failure → RFT Exception; Today counts only proof-backed
    status: completed
  - id: metrics-tests
    content: Tests for metrics honesty and Exception on fail
    status: completed
isProject: false
---

# Plan 16: Proof metrics + fail-visibly

**Status:** DONE

## Goal
Outcomes and Today prove the operation. Failures are visible. Completions without provider proof are not counted as done.

## Concrete commit
Ledger exposes baseline delta / SLA attainment / auto vs human (or honest `not_observable`). Failed outbound/specialty path can move card to Exception. Today recent-completed filters unproven rows.

## Ships when
Owner sees proof metrics (or clear not_observable) and a failed send does not look like success.

## Shipped
- `composeOutcomesLedger` metrics: `baselineDelta`, `slaAttainment`, `autoVsHuman`, `proofBackedCompleted`; unproven recent outcomes excluded from completed
- `OutcomesLedgerExperience` proof metrics section + unproven status pill
- `composeOperatingHomeSupervision` / Today filter proof-backed completed only
- `fireSpecialtyTrigger` fail-visible escalation (Plan 13) preserved

## Depends on
Plans 6, 13.
