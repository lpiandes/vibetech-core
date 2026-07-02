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
- Deterministically selects an assignee using strict ordered rules:
  1. Explicit `assignedTo` already exists.
  2. Matching digital employee.
  3. Matching human employee.
  4. Default department owner (deterministic).
  5. Unassigned.
- Calls `workRuntime.applyEvent()` with `WORK_ITEM_ASSIGNED` (WorkRuntime internal event type).
- Returns an immutable `AssignmentResult`.

## Relationship to `WorkRuntime`
`WorkRuntime` is the system of record for work state.
This integration only updates `WorkRuntime` by applying a Work event (`WORK_ITEM_ASSIGNED`).

## Relationship to `TeamRuntime`
`TeamRuntime` is read-only for this sprint.
Candidate selection is derived from team members already present in `teamRuntime`.

## Future AI / Scheduling / Workload Balancing
Explicitly out of scope for this sprint:
- No AI assignment
- No scheduling
- No workload balancing
- No notifications or communications

