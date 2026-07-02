# Team Runtime (Epic 6 Sprint 1)

## Purpose
Provide the canonical **Team Runtime** for VIBETech.

This runtime answers exactly one question:
> "Who works here?"

It is an ownership layer for all work-performing entities:
- humans
- digital employees
- contractors
- vendors
- future entity types (allowed by model)

## Responsibilities
- `TeamRuntime`
  - owns the immutable in-memory team state (members, departments, roles, metrics, status, recommendations)
  - mutates ONLY through `applyEvent(...)`
- `TeamEventEngine`
  - applies deterministic events to update runtime state
- `TeamBuilder`
  - deterministic default company seeds (industry-agnostic)

## Relationship to Company Runtime
- Company Runtime owns the company and its business state.
- Team Runtime owns workers, departments, roles, and team work metrics.
- Team Runtime must not duplicate Company Runtime state; it only represents team ownership.

## Relationship to Workspace
- Workspace can consume Team data (future sprint).
- This sprint does not include any rendering or UI.

## Relationship to Mission Control
- Mission Control can consume Team when it needs “who is available to act” signals.
- Mission Control remains feature-frozen; it will integrate through composition in future platform updates.

## Future Team Experience
This sprint intentionally does not build org charts, scheduling, analytics, or permissions UI.

