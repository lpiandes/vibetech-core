# Engagement Read Model

Deterministic read-only composition layer for party-centric relationship execution.

## Ownership

Engagement does **not** own canonical business state. It projects from:

- `BusinessGraphRuntime` — parties, relationships
- `RequestRuntime` — requests
- `WorkRuntime` — work items
- `CommunicationRuntime` — threads, messages
- `InteractionRuntime` — interactions, exact human notes, outcomes, follow-ups
- `AutomationRuntime` — automation runs
- `ApprovalRuntime` — approval requests
- `PlatformEventStore` (optional) — cross-OS platform facts

## Primary API

`EngagementViewAdapter.translate({ partyId, ...runtimes })` → immutable `EngagementViewModel`

Includes: unified timeline, follow-up projections, evidence-backed attention items, and deterministic next actions.

Human note text is preserved exactly in timeline items (`metadata.exactHumanNote`).
