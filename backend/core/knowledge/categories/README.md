# Knowledge Categories (Sprint 2)

## Purpose
Knowledge Categories are the permanent classification system for Knowledge OS.
They are not folders; they are first-class business objects that drive:
- company brain context mapping
- deterministic search filtering
- future relevance/ranking and permissions
- employee applicability constraints

## Responsibilities
- `Category` is an immutable business record (id, name, description, hierarchy, tags, metadata).
- `CategoryRepository` provides deterministic operations:
  - create
  - update (bump version)
  - archive (soft, never delete)
  - reorder (sortOrder)
  - list + lookups
- `CompanyWorkspaceRuntime` owns category state and exposes getters.
- `CompanyEventEngine` is the only place that mutates runtime state for category operations.

## Data Flow
1. Category operation is published as a Company Event (`CATEGORY_CREATED`, etc.).
2. `CompanyEventEngine` applies the event to runtime `knowledgeCategories`.
3. `KnowledgeRepository` validates that knowledge item `category` values reference existing categories.
4. `CompanyBrain` continues consuming the legacy `runtime.getKnowledge()` compact compatibility layer.

## Future integration
This sprint intentionally does not build:
- upload UI
- parsing
- brand voice editor
- knowledge search engine UI
- vector search / embeddings

Later sprints can add repository-to-brain mapping improvements once category objects are stable.

