# Request Intelligence Adapter (Epic 9 Sprint 2)

## Purpose
Translate live backend signals from:
- `RequestRuntime`
- `CompanyWorkspaceRuntime`
- `TeamRuntime`
- `WorkRuntime`

into a canonical, immutable `RequestViewModel`.

The adapter answers one question: which requests need attention, which are qualified, and which should become work.

## Responsibilities
- Deterministically translate runtime state into view-model objects.
- Detect deterministic “attention” items (no AI; no heuristics that depend on randomness).
- Generate business actions (not UI logic).
- Enrich request item views with read-only linkage to related work (via `assignedWorkId`).
- Never mutate any runtime or create WorkItems / qualification side effects.

## Relationship to `RequestRuntime`
- Read-only consumption of:
  - `requestRuntime.getRequests()`
  - `requestRuntime.getMetrics()`
- No state mutation. No new requests are created.

## Relationship to `WorkRuntime`
- Read-only enrichment for requests that carry `assignedWorkId`.
- The adapter looks up `workRuntime.getWorkItems()` by id and derives:
  - failed/blocked related work attention
  - “view_related_work” next action and badge

## Relationship to `TeamRuntime`
- Read-only enrichment for requests that carry `assignedTeamMemberId`.
- Used for deterministic mapping/guardrails only (no writes).

## Relationship to `CompanyWorkspaceRuntime`
- Read-only use of company identity (`companyRuntime.getCompany().companyName`) for `companyId`.

## Future Request UI
- React rendering will consume the canonical `RequestViewModel`.
- No UI/React code is added in this sprint.

## Future Qualification Engine
- This sprint does not qualify requests.
- Qualification happens elsewhere; this adapter only translates qualification state into view outputs.

## Future Request → Work Pipeline
- The adapter recommends the business action `convert_to_work`.
- The actual Work creation pipeline is intentionally out of scope for this sprint.

