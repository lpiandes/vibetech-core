# Work Platform Event Publisher Integration (Epic 11 Sprint 4)

## Purpose
Provide a Work-OS wrapper that publishes the canonical `WORK_CREATED` PlatformEvent when WorkRuntime creates a work item via `WORK_ITEM_CREATED`.

This integration:
- does **not** redesign `WorkRuntime`
- does **not** require subscribers to be known by WorkRuntime
- does **not** mutate WorkRuntime state directly
- publishes through the existing Platform Event Publisher framework (`PlatformEventPublisher`)

## Responsibilities
- `WorkPlatformEventMapper`
  - deterministically maps a created WorkItem (or the `WORK_ITEM_CREATED` event) into a canonical `WORK_CREATED` PlatformEvent input contract
- `WorkPlatformEventValidator`
  - validates the canonical `WORK_CREATED` PlatformEvent input contract
- `WorkPlatformEventPublisher`
  - invokes `PlatformEventPublisher.publish()` with the canonical event input
  - returns immutable `PlatformEventPublicationResult`

## Relationship to `PlatformEventStore` / `PlatformEventBus`
The wrapper delegates to `PlatformEventPublisher`, which:
- appends the canonical event to `PlatformEventStore`
- dispatches the canonical event through `PlatformEventBus`

## Future Work
This published `WORK_CREATED` fact enables future pipelines (e.g., Team Assignment, Approval, Automation). Those are out of scope for this sprint.

