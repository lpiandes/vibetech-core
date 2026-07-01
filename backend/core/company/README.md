# Company Workspace Runtime

## Why this runtime exists
`CompanyWorkspaceRuntime` is the first **real “Company” single source of truth (SSOT)** for the VIBETech Workspace UI.

Previously, the Workspace UI relied on scattered mock objects (Dashboard copy, queue items, review content, activity summaries). This runtime centralizes the business inputs into one in-memory “Company” model so every screen can read from the same data contract.

The runtime is intentionally:
- **No-network**
- **No-API**
- **No database**
- **No CRM sync**
- **No runtime-pipeline changes**

## Responsibilities
`CompanyWorkspaceRuntime` provides:
- Deterministic business data for a loaded company
- Immutable (frozen) business objects
- Derived business views:
  - `work queue` items (from `CompanyData.inquiries`)
  - `activities` (first-class timeline events)
  - `metrics` computed from `CompanyData` and `Employees`

All state is stored **in-memory only**.

## Why every screen should read from it
Screens should not each invent their own mock stories. Instead:
- **Dashboard** can generate narrative + timeline from `getActivities()` and employee status from `getEmployees()`
- **Work Queue** can render queue cards from `getWorkQueue()` (no hardcoded queue cards)
- **Review Work / Digital Workforce** can render directly from `getWorkQueue()` + `getEmployees()` + `getKnowledge()`

This keeps the UI:
- consistent across routes
- easier to evolve
- aligned with customer vocabulary

## Future persistence (how it replaces in-memory state)
Today the runtime keeps state in memory. Later, persistence will replace only the *storage mechanism*:
- store the loaded `Company` identity and configuration
- store `CompanyData` records (properties, buyers, inquiries)
- store runtime “governance outcomes” / review decisions
- re-hydrate the same business objects back into this runtime

Because the runtime already exposes stable business objects, the frontend can remain unchanged while persistence is added behind the scenes.

## Future website intake updates
When website intake is added later:
- intake produces new inquiry records
- those records are written into the Company Workspace Runtime’s in-memory state (and later persisted)
- `getWorkQueue()`, `getActivities()`, and `getMetrics()` automatically reflect the new state

No API contract changes are required at the UI level—only the company state changes.

## Future CRM sync reads
If CRM syncing is added later:
- CRM becomes an **optional interface** that maps external contacts/inquiries into CompanyData records
- the mapping writes into CompanyData inside this runtime
- UI continues to read from the runtime SSOT, not from CRM-native schemas

## Knowledge OS (Sprint 1)
The runtime now owns a first-class `knowledgeRepository` and exposes the legacy `getKnowledge()` compact shape as a derived compatibility layer.
`CompanyBrain` continues working exactly as before by consuming `runtime.getKnowledge()`, while the repository becomes the canonical source for future employee context.

