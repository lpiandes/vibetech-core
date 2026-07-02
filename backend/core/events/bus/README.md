# Platform Event Bus (Epic 10 Sprint 3)

## Purpose
Provide an in-process, deterministic routing layer for canonical **PlatformEvents**.

It is **not** the event store.
It is **not** persistence.
It is **not** subscriptions management outside of its own deterministic registry.
It does **not** execute workflows.

## Responsibilities
- `PlatformEventBus`
  - owns an in-memory deterministic registry of subscriptions
  - validates canonical PlatformEvents and subscriber contracts
  - routes events synchronously to matching subscribers
  - returns a deterministic dispatch report
- `PlatformEventSubscriber`
  - represents a subscriber contract:
    - `id`, `name`, `supportedEvents`, `priority`, `handle(event)`
  - `handle(event)` is synchronous and deterministic by contract
- Subscribers decide business logic:
  - the bus never interprets payloads beyond subscriber selection and validation

## Relationship to `PlatformEventStore`
`PlatformEventStore` owns historical event facts.

`PlatformEventBus` is the routing layer that, in a future integration, may consume canonical events (from store or OS publishers) and dispatch them to subscribers.

This sprint does not implement that integration.

## Subscriber Contract
Canonical subscriber shape:
- `id: string`
- `name: string`
- `supportedEvents: string[]`
- `priority: number` (finite integer >= 0)
- `handle(event): { status, message?, metadata? }`

Allowed dispatch result statuses:
- `SUCCESS`
- `FAILED`
- `SKIPPED`

## Dispatch Report Contract
Each `dispatch(event)` returns a frozen report with:
- `eventId`
- `eventType`
- `dispatchedAt`
- `results` (array)
- `successCount`, `failureCount`, `skippedCount`
- `metadata`

Each subscriber result includes:
- `subscriberId`
- `subscriberName`
- `status` (`SUCCESS`/`FAILED`/`SKIPPED`)
- `message`
- `metadata`

## Determinism
- Subscriber dispatch order is deterministic:
  1. ascending `priority`
  2. ascending `subscriber.id`
- No async execution.
- No concurrency.

## Future Roadmap
This bus currently does not implement:
- persistence
- replay
- distributed execution

Future platform work may add:
- persistence/replay via a `Platform Event Bus (future)`
- durable subscription persistence
- distributed dispatch

