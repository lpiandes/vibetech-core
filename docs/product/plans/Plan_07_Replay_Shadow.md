---
name: RFT Replay Shadow
overview: Run proposed RFT contracts against historical events and live shadow mode without external actions; save corrections; require pass before go-live.
todos:
  - id: replay-engine
    content: Build historical replay simulator over RFT contract + observation events
    status: completed
  - id: shadow-mode
    content: Add shadow execution mode that proposes without external side effects
    status: completed
  - id: replay-shadow-ui
    content: UI for replay report + shadow review/corrections; gate go-live
    status: completed
  - id: replay-tests
    content: Tests proving no outbound in shadow/replay and go-live gate
    status: completed
isProject: false
---

# Plan 7: Replay + shadow mode

**Status:** DONE (2026-08-05)

## Goal
Test the Operating Contract before it acts externally.

## Shipped
- `rftReplay.js` — historical replay classifications (would auto / need approval / escalate / problems)
- `executionMode: shadow|replay|live` on `executeSpecialtyPathSteps` — no outbound / no CRM write in non-live
- `fireSpecialtyTrigger` records shadow proposals when shadow enabled
- Launch actions: `replay`, `enableShadow`, `passShadow`, `correctShadow`
- Go-live gated until observe + replay + shadow pass (+ confirm/prove)

## Ships when (met)
Replay runs on imported history; shadow processes live inbound without external send; go-live blocked until pass.

## Depends on
Plans 2 and 6.

## Unblocks
Safe go-live; Plan 8 operator queues; later earned autonomy.
