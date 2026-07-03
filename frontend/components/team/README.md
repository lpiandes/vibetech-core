# Team Rendering Framework (Team OS redesign)

## Purpose
Render the canonical backend `TeamViewModel` into consistent presentation.

This sprint builds the first Team rendering layer (not an individual feature page). React renders only data provided by the backend.

## Responsibilities
- `TeamRenderer`
  - top-level orchestration: provides context and composes the Team executive experience
- `TeamExecutiveLayout`
  - presentation-only workforce cockpit that answers: “How is my workforce performing?”
  - uses only `frontend/components/executive/*` primitives + design tokens
- `TeamContext`
  - provides the canonical `TeamViewModel` (read-only) to the presentation layer

## Relationship to `TeamViewModel`
All renderers read from the canonical `TeamViewModel` (never from runtimes or intelligence engines).

## Future Org Chart
This renderer tree is designed to support a future “org chart” view by composing additional presentation components below the current layout.

