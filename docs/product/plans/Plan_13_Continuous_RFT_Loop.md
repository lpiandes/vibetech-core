---
name: Continuous RFT Event Loop
overview: Wire live inbound events into RFT seed/progress so follow-through runs continuously, not only via launch/prove APIs.
todos:
  - id: rft-inbound-wire
    content: Map INBOUND_SALES_EMAIL / form leads to seedRftOpportunity + progress
    status: pending
  - id: rft-specialty-advance
    content: Advance RFT states from specialty/approval outcomes; Exception on external fail
    status: pending
  - id: rft-loop-tests
    content: Tests for inbound→Detected→ActionProposed without fabricated success
    status: pending
isProject: false
---

# Plan 13: Continuous RFT event loop

**Status:** DONE (2026-08-05)

## Goal
Live work drives the RFT state machine. Inbound email/form → Detected → ContextReady → ActionProposed → ApprovalRequired|AutoEligible → Executing → Verified/Exception — without an operator manually calling progress APIs.

## Concrete commit
At least one real channel event (`INBOUND_SALES_EMAIL` or form lead) seeds an RFT card and advances to ActionProposed (or Exception with honesty). Specialty/approval outcomes can move the card forward. Tests cover the happy path.

## Ships when
A synced inbound sales email creates/progresses an RFT opportunity with evidence; no fake Verified.

## Depends on
Plans 2, 5, 7.

## Shipped
- `rftInboundIngest.js` — ingest + escalate (+ 4/4 tests)
- Wired via `emitSpecialtyBusinessEvent` for inbound event types
- Blueprint trigger includes `INBOUND_SALES_EMAIL` / `WEBSITE_INQUIRY`
- Specialty send failures escalate RFT card to Exception
