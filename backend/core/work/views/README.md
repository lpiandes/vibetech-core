# Work Intelligence Adapter (Epic 7 Sprint 2)

## Purpose
Translate backend runtimes into an immutable canonical **`WorkViewModel`** for consistent presentation.

This sprint builds the “work intelligence” adapter only. It does not build a UI and it does not introduce any new work/approval workflow logic.

## Responsibilities
- `WorkViewAdapter`
  - consumes `WorkRuntime`, `TeamRuntime`, and `CompanyWorkspaceRuntime` (read-only)
  - produces canonical `WorkViewModel`
  - derives deterministic attention items + recommended business actions
- View factories (`WorkItemView`, `WorkQueueView`, `WorkStageView`, `WorkAssignmentView`, `WorkAttentionView`)
  - enforce immutability and schema completeness
- `WorkViewValidator`
  - validates uniqueness, required fields, and immutability contract

## Relationship to `WorkRuntime`
`WorkRuntime` owns:
- work items, stages, queues, assignments, and basic metrics

The adapter only reads and enriches those models (names, computed “age”, derived presentation actions).

## Relationship to `TeamRuntime`
`TeamRuntime` owns:
- workers (members/availability)

The adapter enriches assignments with `assigneeName` from team members.

## Relationship to `CompanyRuntime`
`CompanyWorkspaceRuntime` is used as a read-only signal source (communications/activities/employees/metrics).

This sprint intentionally keeps attention detection deterministic and primarily derived from the work runtime itself.

## Future Integrations
- Future Work UI: render `WorkViewModel` from this adapter.
- Future workflow engine: derive next transitions/actions from the recommended business actions (without moving logic into React).
- Future approvals/automation: compose additional canonical objects into future adapters/view models.

