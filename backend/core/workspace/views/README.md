# Workspace View Layer (Epic 3 Sprint 2)

## Responsibility
The **Workspace View Layer** converts a `WorkspaceConfiguration` (workspace composition decisions) into **frontend-ready view models**.

Key rules:
- React never consumes `WorkspaceConfiguration` directly.
- React consumes view models only.
- The Workspace Generator answers **composition** questions; the View Layer answers **presentation** questions.
- The View Layer is deterministic: the same inputs yield the same view outputs.

## Relationships
- Backend: `backend/core/workspace/WorkspaceGenerator.js`
  - produces an immutable `WorkspaceConfiguration`
- View Layer: `backend/core/workspace/views/*`
  - translates `WorkspaceConfiguration` into view models
  - uses runtime data only as enrichment (optionally) and never as “composition source of truth”
- Frontend: `frontend/lib/workspace/WorkspaceService.ts`
  - loads `WorkspaceConfiguration` via a mock runtime (Sprint 2)
  - calls `WorkspaceViewAdapter`

## Modules
- `WorkspaceViewAdapter.js`: orchestrates translation into all available view models
- `DashboardViewBuilder.js`: builds the Dashboard page view model
- `NavigationViewBuilder.js`: builds Navigation sections/items
- `ModuleViewBuilder.js`: builds Modules list view model
- `RecommendationViewBuilder.js`: builds Recommendations view model
- `QueueViewBuilder.js`: builds Work Queue view model(s)
- `WorkspaceViewValidator.js`: validates view integrity (consistency, duplicates, missing references)

