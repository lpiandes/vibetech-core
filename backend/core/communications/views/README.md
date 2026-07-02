# Communication View Adapter (Epic 13 Sprint 2)

## Purpose
Map canonical communication facts into a single immutable `CommunicationViewModel` for backend-only rendering and executive UX.

This adapter answers:
**“Which communications exist, which need attention, and what is their status?”**

## Responsibilities
- Deterministically translate:
  - `CommunicationRuntime` (threads/messages/participants)
  - `WorkRuntime` (optional enrichment for related work actions)
  - `TeamRuntime` (optional enrichment for participant display)
  - `CompanyWorkspaceRuntime` (optional company identity for `companyId`)
- Compute attention deterministically from message/thread status + timestamps.
- Generate business actions only (no providers, no sending, no drafting).
- Produce deeply immutable, runtime-safe view objects.

## Relationships
- `CommunicationRuntime`: canonical state of threads and messages.
- `WorkRuntime`: optional enrichment to create `view_related_work` / `assign_owner` actions.
- `TeamRuntime`: optional enrichment (participant names).
- Future UI: a communications page can render only the view model produced here.

## Out of scope
- Providers (Gmail/Twilio/etc.)
- AI drafting
- Automation, approvals, or sending side effects
- Any React/UI

