# Communication Runtime (Epic 13 Sprint 1)

## Purpose
`CommunicationRuntime` is the canonical in-memory ownership layer for communication facts.

It answers:
**"What communications exist?"**

It does **not** send messages; sending/delivery is represented only via deterministic status lifecycle events.

## Responsibilities
- Own communication threads and messages.
- Mutate state only through `CommunicationEventEngine`.
- Compute deterministic metrics (counts by status).

## Relationship to other modules
- View/adapters may later translate threads/messages into UI-friendly models.
- Future communications providers (Gmail/Twilio/etc.) are explicitly out of scope for this sprint.

