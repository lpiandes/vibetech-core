# Platform Event Publisher Framework (Epic 10 Sprint 4)

## Purpose
Provide Operating Systems a safe, deterministic way to **publish Platform Events** (business facts).

The publisher framework:
- builds canonical immutable `PlatformEvent`s
- validates event input + publisher constraints
- appends to `PlatformEventStore`
- dispatches through `PlatformEventBus`
- returns an immutable `PlatformEventPublicationResult`

## Responsibilities
- **PlatformEventPublisher**
  - accept event input (fact + routing identifiers)
  - build canonical `PlatformEvent` via `PlatformEventBuilder`
  - validate (publisher shape, allowed event type, event input shape)
  - append to `PlatformEventStore`
  - dispatch via `PlatformEventBus`
  - return `PlatformEventPublicationResult` with deterministic `publicationId`
- **PlatformEventPublisherRegistry**
  - stores publisher contracts (publisher metadata + allowed event types)
  - rejects duplicate publisher IDs
- **PlatformEventPublication / Result**
  - canonical immutable publication outcome record

## Publisher Contract
Canonical publisher metadata:
- `id: string`
- `name: string`
- `operatingSystem: string`
- `allowedEventTypes: string[]`
- `version: number`
- `metadata: object`

## Publication Lifecycle
1. OS calls `PlatformEventPublisher.publish(eventInput)`
2. Publisher:
   - builds canonical `PlatformEvent` (`PlatformEventBuilder`)
   - validates canonical event and constraints
3. Publisher appends to `PlatformEventStore`
4. Publisher dispatches event via `PlatformEventBus`
5. Publisher returns immutable publication result:
   - deterministic `publicationId` derived from `nowISO/eventId/publisherId`
   - stored/dispatched flags and dispatch report (if available)

## Relationship to `PlatformEventStore`
`PlatformEventPublisher` does not store history itself.
The store owns historical facts.

## Relationship to `PlatformEventBus`
`PlatformEventPublisher` dispatches facts through the in-process deterministic bus.
The bus routes facts to subscriber contracts.

## Future OS publishers
Future OS-specific publishers should use this framework without changing any core contract:
- request_os
- work_os
- team_os
- knowledge_os
- communication_os

This sprint intentionally does **not** create those OS publishers or integrate runtimes.

## Future Request→Work Pipeline
Conversion/Work creation is out of scope for this sprint.
The framework provides the safe event publication primitive that future pipelines can adopt.

