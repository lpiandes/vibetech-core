---
name: Ask Draft Confirm
overview: Render Ask actionDraft cards with Preview / Confirm / Do nothing; Confirm patches contract + learning.
todos:
  - id: ask-draft-ui
    content: Ask UI renders actionDraft with Confirm / Preview / Do nothing
    status: completed
  - id: ask-draft-apply
    content: Confirm hits operating-contract PATCH with fromAsk + learningCorrection
    status: completed
  - id: ask-draft-tests
    content: Test draft apply path honesty (preview_only never mutates)
    status: completed
isProject: false
---

# Plan 15: Ask draft confirm

**Status:** DONE

## Goal
Ask is a command interface: drafts are visible and confirmable. Preview-only policies never mutate.

## Concrete commit
When Ask returns `actionDraft` with `needs_confirmation`, UI shows Confirm → applies patch via existing operating-contract API (`fromAsk`). `preview_only` shows Preview without apply.

## Ships when
Owner can confirm “change response promise to one hour” from Ask and see the contract update + learning capture.

## Shipped
- `ActionDraftCard` in Architect `ConversationRail` — Confirm / Do nothing for `needs_confirmation`; Preview only for `preview_only`
- Confirm → PATCH operating-contract with `fromAsk: true` + `learningCorrection`
- `ArchitectWorkspace` tracks `actionDraft` from operating-command responses
- Ask landing helper text updated for confirm flow

## Depends on
Plans 9, 10.
