# Work Rendering Framework (Epic 7 Sprint 3)

## Purpose
Render the canonical backend `WorkViewModel` into a consistent, executive business-work experience.

This sprint builds the first Team-style rendering framework for work (it is not a ticketing system UI and does not implement workflows/automation).

## Responsibilities
- `WorkRenderer`
  - orchestration entry point for rendering a `WorkViewModel`
- `WorkContext`
  - provides `WorkViewModel` to the component tree
- `WorkLayout`
  - layout-only composition (single/two column)
- Renderers (`WorkSummary`, `QueueRenderer`, `StageRenderer`, `WorkItemRenderer`, `AssignmentRenderer`, `AttentionRenderer`, `RecommendationRenderer`)
  - render each section dynamically from the `WorkViewModel` fields

## Relationship to `WorkViewModel`
All renderers are view-only: they read from `WorkViewModel` and never recompute business intelligence.

## Future Integrations
- Future workflow engine / approvals / automation: consume `WorkViewModel.recommendedActions` later.
- Future mobile renderer: reuse the same renderers with responsive layout variants.

