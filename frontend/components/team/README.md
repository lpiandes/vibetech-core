# Team Rendering Framework (Epic 6 Sprint 3)

## Purpose
Render the canonical backend `TeamViewModel` into consistent presentation.

This sprint builds the first Team rendering layer (not an individual feature page). React renders only data provided by the backend.

## Responsibilities
- `TeamRenderer`
  - top-level orchestration: provides context and composes the Team presentation tree
- `TeamLayout`
  - layout-only decisions (single column vs two column via view model metadata / responsive defaults)
- `TeamSummary`
  - renders executive summary + high-level workload metrics
- `DepartmentRenderer`
  - renders each department dynamically from `viewModel.departments`
- `MemberRenderer`
  - renders each member dynamically from `viewModel.members`
- `WorkloadRenderer`
  - renders workload details (utilization, assigned/pending/completed, capacity)
- `AttentionRenderer`
  - renders attention items dynamically and provides deterministic executive empty state
- `RecommendationRenderer`
  - renders recommendations dynamically and provides deterministic executive empty state

## Relationship to `TeamViewModel`
All renderers read from the canonical `TeamViewModel` (never from runtimes or intelligence engines).

## Future Org Chart
This renderer tree is designed to support a future “org chart” view by composing additional presentation components below the current layout.

