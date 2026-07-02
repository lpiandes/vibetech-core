# Work Runtime (Epic 7 Sprint 1)

## Purpose
The `WorkRuntime` is the canonical backend ownership layer for **what work exists** across the business.

It is not a task list, not a CRM pipeline, and not industry-specific.

## Responsibilities
- `WorkRuntime`
  - owns immutable in-memory state (`workItems`, `stages`, `queues`, `assignments`, and derived `metrics`)
  - exposes read-only getters
  - mutates only through `applyEvent()`
- `WorkEventEngine`
  - applies deterministic work events to evolve runtime state
  - deep-freezes the resulting state for immutability
- `WorkBuilder`
  - seeds deterministic universal defaults (stages + queues)
  - provides deterministic seed work state for the runtime
- Models (`WorkItem`, `WorkStage`, `WorkQueue`, `WorkAssignment`)
  - define canonical immutable data shapes and validation rules at creation time
- `WorkMetrics`
  - computes basic runtime metrics deterministically from work state
- `WorkRuntimeValidator`
  - validates state integrity: duplicates, referential integrity, enums, and immutability

## Relationship to other runtimes
- `TeamRuntime` owns workers (who people are and their availability).
- `CompanyRuntime` owns company/business configuration and intelligence sources.
- `MissionControl` consumes work later (future composition), but the Work Runtime does not integrate with it.

## Future Work UI
React will render canonical `WorkRuntime` projections later.
This sprint intentionally does not build any UI or workflow automation.

