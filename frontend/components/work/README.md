# Work Rendering Framework (Epic 7 Sprint 3)

## Purpose
Render the canonical backend `WorkViewModel` into a consistent, executive business-work experience.

This sprint builds the first Team-style rendering framework for work (it is not a ticketing system UI and does not implement workflows/automation).

## Responsibilities
- `WorkRenderer`
  - orchestration entry point for rendering a `WorkViewModel`
- `WorkContext`
  - provides `WorkViewModel` to the component tree
- `WorkExecutiveLayout`
  - executive-only workforce delivery cockpit that answers: “Can my business deliver?”
  - uses only `frontend/components/executive/*` primitives + design tokens
- `WorkLoading`
  - route-level executive loading UX (deterministic skeletons)
- `WorkErrorBoundary`
  - presentation-safe error handling using executive primitives

## Relationship to `WorkViewModel`
The executive view is view-only: it reads from `WorkViewModel` and never recomputes business intelligence.

## Future Integrations
- Future workflow engine / approvals / automation: consume `WorkViewModel.recommendedActions` later.
- Future mobile renderer: reuse the same renderers with responsive layout variants.

