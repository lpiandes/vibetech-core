# Request Conversion Publishing Integration (Epic 11 Sprint 2)

## Purpose
Provide a Request-OS-side wrapper that publishes the canonical `REQUEST_CONVERTED` **PlatformEvent** when a request is converted.

This integration:
- does **not** redesign `RequestRuntime`
- does **not** wire subscribers
- does **not** mutate RequestRuntime state
- publishes through the Platform Event Publishing framework (`PlatformEventPublisher`)

## Responsibilities
- `RequestPlatformEventMapper`
  - deterministically maps a converted Request (and its conversion timestamp) into a canonical PlatformEvent *input* contract
  - derives `eventId`, aggregate identity, and the required payload fields
- `RequestPlatformEventValidator`
  - validates that the mapped PlatformEvent input matches the canonical `REQUEST_CONVERTED` payload contract
- `RequestPlatformEventPublisher`
  - invokes `PlatformEventPublisher.publish()` using the mapped canonical input
  - returns `PlatformEventPublicationResult`

## Relationship to `PlatformEventStore` / `PlatformEventBus`
`RequestPlatformEventPublisher` does not directly manipulate the store or bus.
`PlatformEventPublisher` owns:
- appending to `PlatformEventStore`
- dispatching through `PlatformEventBus`

## Future Request→Work pipeline
The published `REQUEST_CONVERTED` event enables future pipelines (e.g. `RequestToWorkSubscriber`) to prepare work creation actions.

