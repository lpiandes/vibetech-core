---
name: RFT Operator Console
overview: Internal VIBETech operator console for cross-client exceptions, SLA risk, failed actions, low-confidence decisions, takeover, retry, traces, and mandatory root-cause classification.
todos:
  - id: ops-queues
    content: Cross-client exception/SLA/failed/low-confidence queues in admin
    status: completed
  - id: ops-takeover
    content: Takeover, retry, trace view, contract version, customer contact
    status: completed
  - id: ops-root-cause
    content: Mandatory root-cause classification on operator resolve
    status: completed
  - id: ops-tests
    content: Tests for queue aggregation and root-cause requirement
    status: completed
isProject: false
---

# Plan 8: VIBETech operator console

**Status:** DONE (2026-08-05)

## Goal
Early customers get hybrid AI + human service. Operators rescue cases while the platform learns where automation fails.

## Shipped
- `/admin/exceptions` — cross-client operator console (PLATFORM_ADMIN only)
- `buildRftOperatorQueue.js` — RFT Exception, SLA risk, failed specialty fires, stalled approvals, low-confidence AutoEligible
- Merged into dashboard `operatorActions` + dedicated API `GET/POST /api/admin/operator-queue`
- Trace view (RFT history + specialty fire + contract version)
- Support enter / workspace / admin business links
- Resolve requires root-cause enum; persists `configuration.operatorInterventions`; roadmap feed rollup
- RFT Exception resolve advances via `EXCEPTION_RESOLVED` → ActionProposed

## Root causes
Missing integration · Missing business rule · Incorrect classification · Insufficient knowledge · Provider failure · Customer delay · Unsupported action · AI quality failure

## Depends on
Plans 2 and 7.

## Unblocks
Reliable hybrid delivery; Batch C learning/autonomy inputs.
