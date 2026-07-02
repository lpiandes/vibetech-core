# Platform Event Store (Epic 10 Sprint 2)

## Purpose
Provide the canonical, in-memory ownership layer for **Platform Events**.

It answers exactly one question:
**“What business events have occurred?”**

This is not an event bus. It is not subscriptions. It is not workflow execution.

## Responsibilities
- Store owns historical facts:
  - `events` (immutable, deep-frozen `PlatformEvent` records)
  - computed `metrics` (deterministic)
  - read-only in-memory indexes for fast lookups
- The store is append-only:
  - historical events are never mutated or replaced
  - ordering is preserved by append sequence
- No event may enter the store without validation (`PlatformEventValidator`)

## Relationship to future Event Bus
This store is designed to feed (in a future platform iteration) a `Platform Event Bus (future)`.

The bus is not implemented in this sprint. This sprint only owns storage.

## Relationship to Operating Systems
- Operating Systems own business state.
- Operating Systems publish facts via Platform Events (future integration).
- In this sprint, OS integration is not implemented; the store is a standalone canonical history.

## Relationship to Business Events
Platform Events are the canonical immutable record of business facts:
- Request lifecycle events
- Work lifecycle events
- Team lifecycle events
- Knowledge and communications lifecycle events

Subscribers in future systems will consume the store (or bus-delivered events) to compute derived view models and intelligence.

## Future persistence
Persistence is explicitly future:
- durable storage
- replayability (rebuild derived state deterministically)

## Future replay
Replay is explicitly future:
- same event stream should reproduce derived outputs
- deduplication must be eventId-based (see reliability contract)

