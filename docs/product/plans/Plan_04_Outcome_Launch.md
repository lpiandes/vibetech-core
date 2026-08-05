---
name: RFT Outcome Launch
overview: Replace Setup 0/9 and generic Launch Center missions with a seven-step Revenue Follow-Through outcome launch that lives inside Today and gates go-live on connect, confirm, prove, and (when ready) replay/shadow.
todos:
  - id: launch-persist
    content: Add installation.configuration.rftLaunch progress model + read/write helpers
    status: completed
  - id: launch-ui
    content: Replace LaunchCenter 0/N missions on Today with seven-step RFT Launch Path UI
    status: completed
  - id: launch-connect-confirm-prove
    content: Wire connect, confirm responsibility (contract hash), prove-one-case, go-live steps to real APIs
    status: completed
  - id: launch-tests
    content: Tests for launch state machine and honesty (no fake-complete observe/replay/shadow)
    status: completed
isProject: false
---

# Plan 4: Outcome-based RFT launch

**Status:** DONE (2026-08-05)

## Goal
Customer launch is one path to one operating outcome — not nine generic installation missions or a Setup/dashboard toggle (already removed in Plan 3).

## Launch path (single flow)
1. **Connect the work** — email, calendar, lead system (forms/CRM/inbox)
2. **See how work currently happens** — discovered map + baseline (deepened in Plan 6)
3. **Confirm responsibility** — SLAs, owners, approval boundaries, exceptions from RFT contract (`backend/core/ai-builder/operating-contract/rft/`)
4. **Review the replay** — Plan 7; cannot fake-complete
5. **Run in shadow mode** — Plan 7; cannot fake-complete
6. **Prove one real case** — seed/progress RFT opportunity + channel prove
7. **Go live** — enable approved action classes (default remain approval-gated)

## Shipped
- `rftLaunch.js` — persist/evaluate/`applyRftLaunchPatch` with hard-blocked observe/replay/shadow
- API `GET/POST …/rft/launch` — confirm · prove · goLive
- `RftLaunchPath` on Today (`OperatingHomeExperience`) replacing LaunchCenter mission strip
- Tests in `RevenueFollowThrough.test.js` for honesty gates + go-live requirements

## Depends on
Plans 2–3 (done). Plan 5 prove→evidence for a real prove step.

## Unblocks
Managed-service launch demo; Plans 6–7 fill observe/replay/shadow.
