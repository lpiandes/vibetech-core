# Mission Control Rendering Framework

## Purpose
Render the canonical `MissionControlViewModel` from the backend into consistent frontend presentation.

This sprint builds:
- a deterministic rendering layer (no business logic)
- a reusable renderer component tree
- minimal styling for an executive-command-center experience

## Responsibilities
- `MissionControlRenderer`
  - top-level orchestration for rendering a `MissionControlViewModel`
- `MissionControlExecutiveLayout`
  - executive-only layout mapping `MissionControlViewModel` into the “cockpit” experience using `frontend/components/executive/*` primitives and design tokens
- `MissionControlLoading`
  - route-level loading UX using executive loading primitives
- `MissionControlErrorBoundary`
  - presentation-safe error handling for rendering failures

## Mission Control Experience (UX Principles)
This is an executive command center. The experience should feel calm, confident, and premium.

### Loading philosophy
- Loading should never block the layout; we show a consistent skeleton while the route is rendering.
- Use `app/mission-control/loading.tsx` for route-level loading UX.

### Empty state philosophy
- Empty sections should communicate confidence, not absence.
- Never show generic “No Data”. Prefer section-specific executive reassurance.
- Empty sections start collapsed to prevent the page from dominating with empty content.

### Error philosophy
- If Mission Control cannot render, degrade gracefully to a friendly executive fallback.
- Use Next’s `app/mission-control/error.tsx` plus the local `MissionControlErrorBoundary` for presentation-safe error handling.

## Relationship to the backend
- The backend produces `MissionControlViewModel` via `MissionControlViewAdapter`
- React renders only the view model fields
- React does not recompute intelligence

