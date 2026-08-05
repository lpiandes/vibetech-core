---
name: RFT Ask Command
overview: Make Ask the contextual command interface for Revenue Follow-Through — grounded answers and actions from operating state, not an empty New-chat product.
todos:
  - id: ask-context-surface
    content: Wire Ask entry points from Today / Decisions / Outcomes / Company Rules with page context
    status: completed
  - id: ask-grounded-tools
    content: Ground answers on RFT traces, Outcomes ledger, baseline, approvals, Company Rules — cite evidence ids
    status: completed
  - id: ask-operating-actions
    content: Support default operating questions + safe actions (reassign, SLA change draft, show stalled proposals)
    status: completed
  - id: ask-tests
    content: Tests for grounding honesty (no answer without sources) and action gating
    status: completed
isProject: false
---

# Plan 9: Ask as command interface

**Status:** DONE (2026-08-05)

## Goal
Ask is how owners command the operating system — not a blank chat toy. Answers cite stored evidence; mutations are drafts until confirm.

## Shipped
- `askOperatingCommand.js` — five default intents + refuse-without-evidence
- Hooked into `AiBuilderService.chat` (before LLM; no quota; `inventedFacts: false`)
- Ask landing = operating commands (not empty New chat); sidebar “Commands home”
- Suggestions updated; Today + Outcomes deep-link into Ask with prompts/context
- Improve route persists richer context metadata (`cardId`, `outcomeId`, …)
- SLA / reassign drafts + approval what-if preview (confirm on Company Rules)

## Ships when (met)
Ask answers the five operating questions with citations or honest refuse; SLA + reassign produce confirmable drafts; primary entry is not blank New chat.

## Depends on
Plans 2–3. Benefits from 6–8.

## Unblocks
Plan 10 (corrections from Ask become learning inputs).
