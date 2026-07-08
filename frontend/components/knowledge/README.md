# Knowledge Executive Cockpit (Knowledge OS 2.0)

## Purpose
Render the canonical backend `KnowledgeViewModel` into an executive knowledge cockpit that answers:
`Does this business know what it needs to know?`

This sprint builds only the rendering framework: no editing, no upload, no publishing, and no backend search.

## Responsibilities
- `KnowledgeRenderer`
  - top-level orchestration that provides `KnowledgeViewModel` via `KnowledgeContext`
- `KnowledgeExecutiveLayout`
  - executive cockpit composition (Hero, Pulse, Areas, Gaps, Risks, Strengths, Recommendations, Bottom Summary)
- Renderers
  - Legacy document/search renderers are intentionally not used by the executive cockpit.

## Relationship to `KnowledgeViewModel`
The executive cockpit reads from `KnowledgeViewModel` only (via context). React contains no business logic and must not access runtimes.

## Future Integrations
- Future Knowledge Editor (out of scope for this sprint)
- Future search backend (out of scope for this sprint)
- Future Company Brain / AI chat (render-only, out of scope for this sprint)

