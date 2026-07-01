# Company Event Engine

## What this module is
The **Company Event Engine** is the only mechanism allowed to change the in-memory state inside `CompanyWorkspaceRuntime`.

Instead of mutating runtime fields directly, integrations and internal processes publish **business events**:
- website intake publishes `WEBSITE_INQUIRY_RECEIVED`
- validation/triage publishes `BUYER_CREATED` / `BUYER_UPDATED`
- employee execution publishes `WORK_CREATED`
- governance publishes `WORK_APPROVED` / `WORK_REJECTED`
- delivery publishes `EMAIL_SENT`
- any explicit audit step publishes `ACTIVITY_CREATED`

`CompanyWorkspaceRuntime` exposes a single new entry point:
`applyEvent(event)`

Internally, it delegates to the event engine, which:
1. Validates event shape and payload requirements
2. Applies the event to the current company business state
3. Recalculates derived business views (queue, activities, metrics)

## Why event-driven architecture scales
- Integrations become simple **publishers of business events**, not state-manipulators.
- Each integration can evolve without requiring the runtime to change its public API.
- Business rules stay centralized in the event engine, making outcomes consistent and auditable.

## How future integrations become events
Every future input channel maps to a business event:
- Website forms => `WEBSITE_INQUIRY_RECEIVED`
- CRM sync => `BUYER_CREATED` / `BUYER_UPDATED` / `WORK_CREATED`
- Email provider => `EMAIL_SENT`
- Calendar scheduling => (future event type, mapped to WORK_CREATED / ACTIVITY_CREATED)

Because the runtime changes only via events, the platform can:
- add new channels without breaking existing screen consumption
- replay events later (future persistence) to reconstruct the same state

## How multiple industries reuse the same event engine
The event engine does not implement industry-specific UI logic. It applies events to a stable set of business records:
- Buyers
- Properties
- Inquiries
- Activities
- Governance outcomes

Property Management, Law, Dental, HVAC, etc. all reuse the same event engine structure:
- event types stay the same shape (`id`, `timestamp`, `type`, `source`, `payload`)
- payload fields are standardized per event type
- derived outputs are computed from stable business records

