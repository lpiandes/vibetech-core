# Knowledge Rendering Framework (Epic 8 Sprint 1)

## Purpose
Render the canonical backend `KnowledgeViewModel` into a consistent executive knowledge experience.

This sprint builds only the rendering framework: no editing, no upload, no publishing, and no backend search.

## Responsibilities
- `KnowledgeRenderer`
  - top-level orchestration that provides `KnowledgeViewModel` via `KnowledgeContext`
- `KnowledgeLayout`
  - layout-only composition (single/two column)
- Renderers
  - `KnowledgeSummary` (knowledge/repository/category/coverage/recommendations summary)
  - `KnowledgeCategoryRenderer` (category list)
  - `KnowledgeItemRenderer` (knowledge items list)
  - `KnowledgeSearchRenderer` (search UI only)
  - `KnowledgeRecommendationRenderer` (recommendations list + empty state)

## Relationship to `KnowledgeViewModel`
All renderers read from `KnowledgeViewModel` only (via context). React contains no business logic.

## Future Integrations
- Future Knowledge Editor
- Future search backend
- Future Company Brain / AI chat (render-only)

