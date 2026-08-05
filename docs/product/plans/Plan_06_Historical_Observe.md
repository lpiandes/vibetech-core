---
name: RFT Historical Observe
overview: Import 30–90 days of history after connect, reconstruct opportunity timelines, and produce an evidence-linked baseline report before automation.
todos:
  - id: observe-import
    content: Import 30–90 day activity from connected email/calendar/CRM/forms
    status: completed
  - id: observe-reconstruct
    content: Reconstruct opportunity timelines with evidence refs
    status: completed
  - id: observe-baseline-ui
    content: Evidence-linked baseline report UI for launch step 2 / Outcomes
    status: completed
  - id: observe-tests
    content: Tests for baseline math and not-observable honesty
    status: completed
isProject: false
---

# Plan 6: Historical observation + baseline

**Status:** DONE (2026-08-05)

## Goal
Show how the business currently operates using real evidence — every number links to source records. Value before automation.

## Shipped
- `rftObservation.js` — build events from Gmail inbox / CRM calendar / form leads / RFT cards; `composeBaselineReport` with `not_observable` honesty
- Persist `installation.configuration.rftObservation`
- Launch action `observe` — optional Gmail `newer_than:Nd` sync then baseline
- Baseline strip on Today launch + Outcomes ledger
- Observe step unlocks when baseline exists

## Honesty
Missing channel = missing metric with explicit “not observable” — never invent medians.

## Depends on
Plans 2 and 5.

## Unblocks
Plan 7 replay.
