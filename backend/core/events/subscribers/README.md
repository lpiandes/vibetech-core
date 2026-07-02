# Platform Event Subscriber Framework (Epic 10 Sprint 5)

## Purpose
Provide Operating Systems a safe, deterministic way to react to canonical **Platform Events**.

The framework is **not** request→work and **not** workflow execution. It only standardizes subscriber contracts, registry behavior, and deterministic subscriber results.

## Responsibilities
- `PlatformEventSubscriberFactory`
  - creates canonical subscriber objects from a handler function + metadata
  - enforces subscriber shape
  - supports deterministic DISABLED behavior (handler is not executed)
- `PlatformEventSubscriberRegistry`
  - registers/unregisters subscribers
  - provides read-only query APIs:
    - `getSubscribers()`
    - `getSubscribersByEvent(eventType)`
    - `getEnabledSubscribersByEvent(eventType)`
  - does **not** dispatch events
- `PlatformEventSubscriberValidator`
  - validates subscriber shape
  - validates subscriber result shape
  - ensures bus compatibility (contract-level)
- `PlatformEventSubscriberResult`
  - defines the immutable subscriber result contract

## Subscriber Contract
A subscriber includes:
- `id: string`
- `name: string`
- `operatingSystem: string`
- `supportedEvents: string[]`
- `priority: number`
- `enabled: boolean`
- `handle(event, context)`

`handle(event, context)` is deterministic by contract. For bus compatibility, the bus calls `handle(event)` (one argument), so `context` must be optional.

## Subscriber Result Contract
The subscriber returns an immutable result with:
- `subscriberId`
- `subscriberName`
- `eventId`
- `eventType`
- `status`
- `message`
- `actions`
- `errors`
- `metadata`

Allowed `status` values:
- `SUCCESS`
- `FAILED`
- `SKIPPED`
- `DISABLED`

## Relationship to `PlatformEventBus`
This framework’s subscriber objects are designed to be compatible with:
- `PlatformEventBus.subscribe({ eventType, subscriber })`
- `PlatformEventBus.dispatch(event)`

Bus-compatible subscriber fields required by the bus:
- `id`, `name`, `supportedEvents`, `priority`, `handle(event)`

`enabled` is honored by the factory wrapper (DISABLED subscribers do not execute the handler).

## Relationship to future Operating Systems
Future OS publishers (request_os/work_os/team_os/knowledge_os/communication_os) will use this framework to register event handlers as deterministic subscribers—without direct runtime coupling.

## Future Request→Work subscriber
This sprint does not create any Request→Work subscribers.
In future, conversion pipelines can register a subscriber that reacts to request lifecycle events and emits work creation facts (out of scope for this sprint).

