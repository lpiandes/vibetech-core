# Request Rendering Framework (Requests OS redesign)

## Responsibilities
- `RequestRenderer`
  - top-level wrapper that receives a canonical `RequestViewModel`
  - provides `RequestViewModel` via context
- `RequestExecutiveLayout`
  - executive-only “opportunities cockpit” that answers: “Where are tomorrow's opportunities?”
  - uses only `frontend/components/executive/*` primitives + design tokens
- `RequestLoading`
  - deterministic loading placeholders
- `RequestErrorBoundary`
  - graceful rendering fallback

## Relationship to `RequestViewModel`
The executive view consumes exactly one input: the canonical immutable `RequestViewModel`.
React owns presentation only; it never mutates runtimes and never recomputes intelligence.

## Future Qualification Engine
- Qualification will occur in a backend engine and only reflected as `RequestViewModel.status/qualificationStatus`.

## Future Request → Work Pipeline
- Conversion will occur in a backend pipeline and only reflected via `assignedWorkId` enrichment in item views.

## Future CRM integrations
- Out of scope for this sprint; React will only render view model fields.

