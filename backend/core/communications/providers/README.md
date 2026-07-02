# Communication Provider Execution Layer (Epic 13 Sprint 4)

## Purpose
Coordinate external communication delivery without owning communication state.

This layer answers:
**“How does a provider execute a communication without owning communication state?”**
by using:
- `CommunicationExecutionService` for orchestration
- a provider contract (`CommunicationProvider`)
- a deterministic provider registry (`CommunicationProviderRegistry`)

## Responsibilities
- `CommunicationRuntime` remains the canonical owner of communication state.
- Providers execute delivery only (no state mutation).
- `CommunicationExecutionService`:
  - looks up messages from `CommunicationRuntime`
  - validates provider support for the message channel
  - calls `provider.send({ message })`
  - applies exactly one runtime event:
    - `COMMUNICATION_MESSAGE_SENT` on success
    - `COMMUNICATION_MESSAGE_FAILED` on failure
  - returns an immutable `CommunicationExecutionResult`

## Relationships
- `CommunicationRuntime`: state source of truth.
- `CommunicationProviderRegistry`: provider selection by `supportedChannels`.
- Providers: external delivery adapters (Gmail/Twilio/etc. out of scope in this sprint).

## Out of scope (explicitly)
- Gmail/Twilio/OAuth or any real network sending.
- AI drafting.
- UI/React.
- Approvals, automation, or retry workers.

