# Work Platform Team Assignment Integration (Epic 11 Sprint 5)

## Purpose
When Work OS publishes a canonical `WORK_CREATED` PlatformEvent, Team OS deterministically decides who owns the newly created work item by publishing a Work assignment fact into `WorkRuntime`.

This sprint intentionally stays minimal:
- Subscriber stays thin.
- Assignment logic is centralized in `AssignmentService`.

## Responsibilities
### `TeamAssignmentSubscriber`
- Validates it is handling `WORK_CREATED`.
- Delegates all assignment logic to `AssignmentService`.
- Returns a bus-compatible result (`SUCCESS` / `FAILED` / `SKIPPED`).

### `AssignmentService`
- Deterministically selects an assignee.

If `capabilityRuntime` is provided, the service prefers capability-aware selection:
1. Run `CapabilityMatchingEngine` against `capabilityRuntime`, `teamRuntime`, and the `WorkItem`.
2. If `bestMatch` is present, assign to `bestMatch.providerId` (deterministically).

If no `bestMatch` is present (or if `capabilityRuntime` is absent), the service falls back to the existing deterministic order:
1. Matching digital employee.
2. Matching human employee.
3. Default department owner (deterministic).
4. Unassigned.

Explicit `assignedTo` always wins and bypasses capability matching.
- Calls `workRuntime.applyEvent()` with `WORK_ITEM_ASSIGNED` (WorkRuntime internal event type).
- Returns an immutable `AssignmentResult`.

## Relationship to `WorkRuntime`
`WorkRuntime` is the system of record for work state.
This integration only updates `WorkRuntime` by applying a Work event (`WORK_ITEM_ASSIGNED`).

## Relationship to `TeamRuntime`
`TeamRuntime` is read-only for this sprint.
Candidate selection is derived from team members already present in `teamRuntime`.

## Capability-aware assignment
`TeamAssignmentSubscriber` may be constructed with an optional `capabilityRuntime`.
When provided, `AssignmentService` uses `CapabilityMatchingEngine` to choose the best capable owner.
When not provided (or when no best match exists), the service falls back to the existing deterministic order.

## Future AI / Scheduling / Workload Balancing
Explicitly out of scope for this sprint:
- No AI assignment
- No scheduling
- No workload balancing
- No notifications or communications

Future ownership boundaries:
- Work Runtime remains the only source of work state.
- Team Runtime remains read-only for this integration.
- Capability Runtime remains read-only; matching only evaluates fit.

